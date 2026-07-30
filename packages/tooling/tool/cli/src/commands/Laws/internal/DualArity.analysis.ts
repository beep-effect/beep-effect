/**
 * ts-morph analysis engine for the public API dual-arity law.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { Effect, MutableHashSet, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { Node, SyntaxKind } from "ts-morph";
import {
  createWorkspaceOwnerResolver,
  getNonTemplateCallSignatures,
  hasJsDocCategory,
  isParameterOwner,
  isStrictObjectLikeType,
  parseNumericLiteral,
  unwrapExpression,
} from "../../../internal/tsmorph/index.ts";
import { DualArityInventoryEntry } from "../Laws.schemas.ts";
import { DualArityRender } from "./DualArity.render.ts";
import type {
  CallExpression,
  FunctionDeclaration,
  MethodDeclaration,
  ParameterDeclaration,
  PropertyDeclaration,
  SourceFile,
  Type,
  VariableDeclaration,
} from "ts-morph";
import type { ParameterOwner } from "../../../internal/tsmorph/index.ts";
import type { DualArityDiagnosticKind, DualArityEntryKind } from "../Laws.schemas.ts";

const NON_PIPEABLE_FIRST_PARAMETER_NAMES = ["message", "options", "config", "status", "severity"] as const;
const PIPEABLE_PARAMETER_NAME_PATTERN =
  /^(self|that|value|input|source|effect|schema|cause|request|context|node|project|file|error)$/iu;
const DIRECT_EFFECT_OR_SCHEMA_TYPE_PATTERN =
  /\bEffect\.Effect\b|\bEffect<|\bS\.Schema\b|\bSchema\.Schema\b|\bSchema<|\bPromise\b/iu;
const REACT_HOOK_NAME_PATTERN = /^use[A-Z0-9]/u;
const REACT_COMPONENT_NAME_PATTERN = /^[A-Z]/u;

type DualBindingIndex = {
  readonly validNamed: MutableHashSet.MutableHashSet<string>;
  readonly validNamespaces: MutableHashSet.MutableHashSet<string>;
  readonly validDualFactoryNamed: MutableHashSet.MutableHashSet<string>;
  readonly validDualFactoryNamespaces: MutableHashSet.MutableHashSet<string>;
  readonly invalidNamed: MutableHashSet.MutableHashSet<string>;
  readonly invalidNamespaces: MutableHashSet.MutableHashSet<string>;
};

type DualCallInfo = {
  readonly callExpression: CallExpression;
  readonly validSource: boolean;
  readonly arity: O.Option<number>;
  readonly implementation: O.Option<ParameterOwner>;
};

type PublicApiCandidate = {
  readonly file: string;
  readonly qualifiedName: string;
  readonly kind: DualArityEntryKind;
  readonly owner: string;
  readonly line: number;
  readonly column: number;
  readonly parameterCount: number;
  readonly firstParameterName: O.Option<string>;
  readonly restParameters: ReadonlyArray<ParameterDeclaration>;
  readonly thirdParameterType: O.Option<Type>;
  readonly dualCall: O.Option<DualCallInfo>;
  readonly callableType: Type;
};

type PermanentDualArityExclusion = {
  readonly file: string;
  readonly qualifiedName: string;
  readonly reason: string;
};

const isExcludedPublicApiName = (filePath: string, qualifiedName: string): boolean => {
  const name = pipe(
    Str.split(".")(qualifiedName),
    A.last,
    O.getOrElse(() => qualifiedName)
  );
  return (
    REACT_HOOK_NAME_PATTERN.test(name) || (Str.endsWith(".tsx")(filePath) && REACT_COMPONENT_NAME_PATTERN.test(name))
  );
};

const collectDualBindings = (sourceFile: SourceFile): DualBindingIndex => {
  const bindings: DualBindingIndex = {
    validNamed: MutableHashSet.empty<string>(),
    validNamespaces: MutableHashSet.empty<string>(),
    validDualFactoryNamed: MutableHashSet.empty<string>(),
    validDualFactoryNamespaces: MutableHashSet.empty<string>(),
    invalidNamed: MutableHashSet.empty<string>(),
    invalidNamespaces: MutableHashSet.empty<string>(),
  };

  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    if (importDeclaration.isTypeOnly()) {
      continue;
    }

    const moduleName = importDeclaration.getModuleSpecifierValue();
    const namedTarget = moduleName === "effect/Function" ? bindings.validNamed : bindings.invalidNamed;
    const namespaceTarget = moduleName === "effect/Function" ? bindings.validNamespaces : bindings.invalidNamespaces;
    const namespaceImport = importDeclaration.getNamespaceImport();
    const isErrFactoryModule = moduleName === "@beep/utils" || moduleName === "@beep/utils/Errors";

    if (P.isNotUndefined(namespaceImport)) {
      MutableHashSet.add(namespaceTarget, namespaceImport.getText());
      if (isErrFactoryModule) {
        MutableHashSet.add(bindings.validDualFactoryNamespaces, namespaceImport.getText());
        MutableHashSet.add(bindings.validDualFactoryNamespaces, `${namespaceImport.getText()}.Err`);
      }
    }

    for (const namedImport of importDeclaration.getNamedImports()) {
      if (namedImport.isTypeOnly()) {
        continue;
      }

      const importedName = namedImport.getName();
      const localName = namedImport.getAliasNode()?.getText() ?? importedName;

      if (importedName === "dual") {
        MutableHashSet.add(namedTarget, localName);
      }

      if (isErrFactoryModule && importedName === "Err") {
        MutableHashSet.add(bindings.validDualFactoryNamespaces, localName);
      }

      if (isErrFactoryModule && (importedName === "mapCauseError" || importedName === "mapToError")) {
        MutableHashSet.add(bindings.validDualFactoryNamed, localName);
      }
    }
  }

  return bindings;
};

const DUAL_MAPPER_FACTORY_NAMES = ["mapCauseError", "mapToError"] as const;

const isDualMapperFactoryName = (name: string): boolean => A.contains(DUAL_MAPPER_FACTORY_NAMES, name);

const getDualCallInfo = (node: import("ts-morph").Node, bindings: DualBindingIndex): O.Option<DualCallInfo> => {
  const expression = unwrapExpression(node);
  if (!Node.isCallExpression(expression)) {
    return O.none();
  }

  const callee = expression.getExpression();
  let validSource = false;
  let dualLike = false;
  let hasExplicitArityArgument = false;

  if (Node.isIdentifier(callee)) {
    validSource =
      MutableHashSet.has(bindings.validNamed, callee.getText()) ||
      MutableHashSet.has(bindings.validDualFactoryNamed, callee.getText());
    dualLike =
      validSource || MutableHashSet.has(bindings.invalidNamed, callee.getText()) || callee.getText() === "dual";
    hasExplicitArityArgument = callee.getText() === "dual" || MutableHashSet.has(bindings.validNamed, callee.getText());
  }

  if (Node.isPropertyAccessExpression(callee) && callee.getName() === "dual") {
    const receiverText = callee.getExpression().getText();
    validSource = MutableHashSet.has(bindings.validNamespaces, receiverText);
    dualLike = validSource || MutableHashSet.has(bindings.invalidNamespaces, receiverText);
    hasExplicitArityArgument = true;
  }

  if (Node.isPropertyAccessExpression(callee) && isDualMapperFactoryName(callee.getName())) {
    const receiverText = callee.getExpression().getText();
    validSource = MutableHashSet.has(bindings.validDualFactoryNamespaces, receiverText);
    dualLike = validSource;
  }

  if (!dualLike) {
    return O.none();
  }

  const argumentsList = expression.getArguments();
  const implementation = pipe(A.get(argumentsList, 1), O.map(unwrapExpression), O.filter(isParameterOwner));

  return O.some({
    callExpression: expression,
    validSource,
    arity: hasExplicitArityArgument ? pipe(A.get(argumentsList, 0), O.flatMap(parseNumericLiteral)) : O.none(),
    implementation,
  });
};

const getEffectFnImplementation = (node: import("ts-morph").Node): O.Option<ParameterOwner> => {
  const expression = unwrapExpression(node);
  if (!Node.isCallExpression(expression)) {
    return O.none();
  }

  const calleeText = expression.getExpression().getText();
  if (calleeText !== "Effect.fn" && calleeText !== "Effect.fnUntraced") {
    return O.none();
  }

  return pipe(expression.getArguments(), A.findLast(isParameterOwner));
};

const getInitializerParameterOwner = (
  initializer: import("ts-morph").Node,
  dualCall: O.Option<DualCallInfo>
): O.Option<ParameterOwner> => {
  const expression = unwrapExpression(initializer);
  if (isParameterOwner(expression)) {
    return O.some(expression);
  }

  if (O.isSome(dualCall) && O.isSome(dualCall.value.implementation)) {
    return dualCall.value.implementation;
  }

  return getEffectFnImplementation(expression);
};

const isFunctionExportInitializer = (
  initializer: import("ts-morph").Node,
  dualCall: O.Option<DualCallInfo>
): boolean => {
  const expression = unwrapExpression(initializer);
  return (
    isParameterOwner(expression) ||
    O.isSome(dualCall) ||
    O.isSome(getEffectFnImplementation(expression)) ||
    Node.isCallExpression(expression)
  );
};

const SCHEMA_CALLABLE_VALUE_FACTORY_PATTERN =
  /^(?:(?:S|Schema)\.(?:decodeEffect|decodeOption|decodeResult|decodeUnknownEffect|decodeUnknownOption|decodeUnknownResult|encodeEffect|encodeOption|encodeResult|encodeUnknownEffect|encodeUnknownOption|encodeUnknownResult|toEquivalence)|SchemaUtils\.toEquivalence)$/u;

const isOrderValueType = (type: Type): boolean => {
  const typeText = type.getText();
  return Str.includes(".Order<")(typeText) || Str.includes("Order.Order<")(typeText);
};

const isSchemaCallableValueFactory = (initializer: import("ts-morph").Node): boolean => {
  const expression = unwrapExpression(initializer);
  return (
    Node.isCallExpression(expression) &&
    SCHEMA_CALLABLE_VALUE_FACTORY_PATTERN.test(expression.getExpression().getText())
  );
};

const isNonHelperCallableValue = (initializer: import("ts-morph").Node, callableType: Type): boolean =>
  isOrderValueType(callableType) || isSchemaCallableValueFactory(initializer);

const isCallableType = (type: Type): boolean => !A.isReadonlyArrayEmpty(type.getCallSignatures());

const getTypeSignatureParameterCount = (type: Type): O.Option<number> => {
  const signatures = getNonTemplateCallSignatures(type);
  if (A.isReadonlyArrayEmpty(signatures)) {
    return O.none();
  }

  return O.some(
    pipe(
      signatures,
      A.map((signature) => signature.getParameters().length),
      A.reduce(0, (largest, count) => Math.max(largest, count))
    )
  );
};

const getParameterOwnerCount = (parameterOwner: O.Option<ParameterOwner>): O.Option<number> =>
  O.map(parameterOwner, (owner) => owner.getParameters().length);

const getRequiredParameterCount = (parameters: ReadonlyArray<ParameterDeclaration>): number =>
  A.filter(
    parameters,
    (parameter) => !parameter.isRestParameter() && !parameter.isOptional() && P.isUndefined(parameter.getInitializer())
  ).length;

const hasRestParameter = (parameters: ReadonlyArray<ParameterDeclaration>): boolean =>
  A.some(parameters, (parameter) => parameter.isRestParameter());

const hasDeferredPublicParameterShape = (parameters: ReadonlyArray<ParameterDeclaration>): boolean =>
  hasRestParameter(parameters) || getRequiredParameterCount(parameters) < 2;

const hasRequiredTypeSignatureShape = (callableType: Type): boolean =>
  A.some(getNonTemplateCallSignatures(callableType), (signature) => {
    const signatureParameters = signature.getParameters();
    const declarations = pipe(
      signatureParameters,
      A.map((parameter) =>
        pipe(O.fromNullishOr(parameter.getValueDeclaration()), O.filter(Node.isParameterDeclaration))
      ),
      A.getSomes
    );
    return declarations.length === signatureParameters.length && !hasDeferredPublicParameterShape(declarations);
  });

const shouldDeferPublicParameterShape = (
  parameters: ReadonlyArray<ParameterDeclaration>,
  callableType: Type,
  parameterCount: number
): boolean =>
  (A.isReadonlyArrayEmpty(parameters)
    ? !hasRequiredTypeSignatureShape(callableType)
    : hasDeferredPublicParameterShape(parameters)) && !hasDualSignatures(callableType, parameterCount);

const getCallableParameterCount = (
  callableType: Type,
  parameterOwner: O.Option<ParameterOwner>,
  dualCall: O.Option<DualCallInfo>
): O.Option<number> =>
  pipe(
    getParameterOwnerCount(parameterOwner),
    O.orElse(() =>
      pipe(
        dualCall,
        O.flatMap((info) => info.arity)
      )
    ),
    O.orElse(() => getTypeSignatureParameterCount(callableType))
  );

const hasDualSignatures = (callableType: Type, arity: number): boolean => {
  const signatures = getNonTemplateCallSignatures(callableType);
  const hasDataFirst = A.some(signatures, (signature) => signature.getParameters().length === arity);
  const hasDataLast = A.some(signatures, (signature) => {
    if (signature.getParameters().length !== arity - 1) {
      return false;
    }

    return A.some(
      signature.getReturnType().getCallSignatures(),
      (returnSignature) => returnSignature.getParameters().length === 1
    );
  });

  return hasDataFirst && hasDataLast;
};

const getThirdParameterType = (
  callableType: Type,
  parameterOwner: O.Option<ParameterOwner>,
  arity: number
): O.Option<Type> => {
  if (arity !== 3) {
    return O.none();
  }

  const implementationParameter = pipe(
    parameterOwner,
    O.flatMap((owner) => A.get(owner.getParameters(), 2)),
    O.map((parameter) => parameter.getType())
  );
  if (O.isSome(implementationParameter)) {
    return implementationParameter;
  }

  return pipe(
    getNonTemplateCallSignatures(callableType),
    A.findFirst((signature) => signature.getParameters().length === 3),
    O.flatMap((signature) => A.get(signature.getParameters(), 2)),
    O.flatMap((parameterSymbol) => O.fromNullishOr(parameterSymbol.getValueDeclaration())),
    O.filter(Node.isParameterDeclaration),
    O.map((parameter) => parameter.getType())
  );
};

const isFactoryReturnType = (type: Type): boolean => {
  const typeText = type.getText();
  if (DIRECT_EFFECT_OR_SCHEMA_TYPE_PATTERN.test(typeText)) {
    return false;
  }

  return (
    A.some(type.getCallSignatures(), (signature) => signature.getParameters().length === 0) ||
    isStrictObjectLikeType(type)
  );
};

const hasMultiParameterCallableShape = (callableType: Type, parameterOwner: O.Option<ParameterOwner>): boolean =>
  O.exists(getParameterOwnerCount(parameterOwner), (count) => count >= 2) ||
  A.some(callableType.getCallSignatures(), (signature) => signature.getParameters().length >= 2);

const isLegitimateConstructorFactory = (
  docNode: import("ts-morph").Node,
  callableType: Type,
  parameterOwner: O.Option<ParameterOwner>
): boolean =>
  hasJsDocCategory({ node: docNode, category: "constructors" }) &&
  hasMultiParameterCallableShape(callableType, parameterOwner) &&
  A.some(callableType.getCallSignatures(), (signature) => isFactoryReturnType(signature.getReturnType()));

const isLegitimateConstructorVariableDeclaration = (
  filePath: string,
  declaration: VariableDeclaration,
  bindings: DualBindingIndex
): boolean => {
  const nameNode = declaration.getNameNode();
  if (!Node.isIdentifier(nameNode) || isExcludedPublicApiName(filePath, nameNode.getText())) {
    return false;
  }

  const initializer = declaration.getInitializer();
  const callableType = declaration.getType();
  if (P.isUndefined(initializer) || !isFunctionExportInitializer(initializer, getDualCallInfo(initializer, bindings))) {
    return false;
  }

  const dualCall = getDualCallInfo(initializer, bindings);
  const parameterOwner = getInitializerParameterOwner(initializer, dualCall);
  return pipe(
    O.fromNullishOr(declaration.getVariableStatement()),
    O.exists((statement) => isLegitimateConstructorFactory(statement, callableType, parameterOwner))
  );
};

const isLegitimateConstructorFunctionDeclaration = (filePath: string, declaration: FunctionDeclaration): boolean => {
  const name = declaration.getName();
  if (!declaration.isExported() || P.isUndefined(declaration.getBody()) || P.isUndefined(name)) {
    return false;
  }

  return (
    !isExcludedPublicApiName(filePath, name) &&
    isLegitimateConstructorFactory(declaration, declaration.getType(), O.some(declaration))
  );
};

const isLegitimateConstructorStaticMember = (
  filePath: string,
  qualifiedName: string,
  member: MethodDeclaration | PropertyDeclaration,
  bindings: DualBindingIndex
): boolean => {
  if (!isPublicStaticMember(member) || isExcludedPublicApiName(filePath, qualifiedName)) {
    return false;
  }

  if (Node.isMethodDeclaration(member)) {
    return isLegitimateConstructorFactory(member, member.getType(), O.some(member));
  }

  const initializer = member.getInitializer();
  const dualCall = P.isUndefined(initializer) ? O.none<DualCallInfo>() : getDualCallInfo(initializer, bindings);
  const parameterOwner = P.isUndefined(initializer)
    ? O.none<ParameterOwner>()
    : getInitializerParameterOwner(initializer, dualCall);
  return isLegitimateConstructorFactory(member, member.getType(), parameterOwner);
};

const isPipeableParameter = (parameter: ParameterDeclaration): boolean => {
  const parameterName = parameter.getName();
  const typeText = parameter.getType().getText();
  return PIPEABLE_PARAMETER_NAME_PATTERN.test(parameterName) || DIRECT_EFFECT_OR_SCHEMA_TYPE_PATTERN.test(typeText);
};

const hasObviousWrongFirstParameter = (
  firstParameterName: O.Option<string>,
  restParameters: ReadonlyArray<ParameterDeclaration>
): boolean =>
  O.exists(
    firstParameterName,
    (name) =>
      A.some(NON_PIPEABLE_FIRST_PARAMETER_NAMES, (nonPipeableName) => name === nonPipeableName) &&
      A.some(restParameters, isPipeableParameter)
  );

const collectCandidateDiagnostics = (candidate: PublicApiCandidate): ReadonlyArray<DualArityDiagnosticKind> => {
  let diagnostics = A.empty<DualArityDiagnosticKind>();
  const dualCall = candidate.dualCall;
  const dualArity = pipe(
    dualCall,
    O.flatMap((info) => info.arity)
  );
  const hasPredicateDualWithPublicDualShape =
    O.isSome(dualCall) && O.isNone(dualArity) && hasDualSignatures(candidate.callableType, candidate.parameterCount);
  const hasMatchingDualArity =
    O.exists(dualArity, (arity) => arity === candidate.parameterCount) || hasPredicateDualWithPublicDualShape;
  const hasValidDualWithCallableThirdParameter =
    O.isSome(dualCall) &&
    dualCall.value.validSource &&
    hasMatchingDualArity &&
    pipe(candidate.thirdParameterType, O.exists(isCallableType));

  if (candidate.parameterCount > 3) {
    diagnostics = A.append(diagnostics, "too-many-positional-params");
  }

  if (candidate.parameterCount >= 2 && candidate.parameterCount <= 3) {
    if (O.isNone(dualCall)) {
      diagnostics = A.append(diagnostics, "missing-dual");
    } else {
      if (!dualCall.value.validSource) {
        diagnostics = A.append(diagnostics, "invalid-dual-source");
      }
      if (!hasMatchingDualArity) {
        diagnostics = A.append(diagnostics, "invalid-dual-arity");
      }
      if (
        dualCall.value.validSource &&
        hasMatchingDualArity &&
        !hasDualSignatures(candidate.callableType, candidate.parameterCount)
      ) {
        diagnostics = A.append(diagnostics, "missing-dual-signatures");
      }
    }
  }

  if (candidate.parameterCount > 3 && O.isSome(dualArity) && dualArity.value > 3) {
    diagnostics = A.append(diagnostics, "invalid-dual-arity");
  }

  if (
    candidate.parameterCount === 3 &&
    !pipe(candidate.thirdParameterType, O.exists(isStrictObjectLikeType)) &&
    !hasValidDualWithCallableThirdParameter
  ) {
    diagnostics = A.append(diagnostics, "third-param-not-object-like");
  }

  if (hasObviousWrongFirstParameter(candidate.firstParameterName, candidate.restParameters)) {
    diagnostics = A.append(diagnostics, "obvious-wrong-first-parameter");
  }

  return A.dedupe(diagnostics);
};

const makeOwnerResolver = Effect.fn("DualArity.makeOwnerResolver")(function* () {
  return yield* createWorkspaceOwnerResolver({
    root: process.cwd(),
    fallbackOwner: "@beep/root",
    swallowWorkspaceErrors: true,
    fallbackPrefixes: [
      { prefix: "packages/tooling/tool/cli/", owner: "@beep/repo-cli" },
      { prefix: "packages/tooling/library/repo-utils/", owner: "@beep/repo-utils" },
      { prefix: "infra/", owner: "@beep/infra" },
    ],
  });
});

const collectFunctionCandidate = (
  sourceFile: SourceFile,
  filePath: string,
  owner: string,
  declaration: FunctionDeclaration
): O.Option<PublicApiCandidate> => {
  if (!declaration.isExported() || P.isUndefined(declaration.getBody())) {
    return O.none();
  }

  const name = declaration.getName();
  if (P.isUndefined(name) || isExcludedPublicApiName(filePath, name)) {
    return O.none();
  }

  const position = sourceFile.getLineAndColumnAtPos(declaration.getNameNode()?.getStart() ?? declaration.getStart());
  const parameters = declaration.getParameters();
  const parameterCount = parameters.length;
  if (parameterCount < 2 || shouldDeferPublicParameterShape(parameters, declaration.getType(), parameterCount)) {
    return O.none();
  }
  if (isLegitimateConstructorFactory(declaration, declaration.getType(), O.some(declaration))) {
    return O.none();
  }

  return O.some({
    file: filePath,
    qualifiedName: name,
    kind: "exported-function",
    owner,
    line: position.line,
    column: position.column,
    parameterCount,
    firstParameterName: pipe(
      A.get(declaration.getParameters(), 0),
      O.map((parameter) => parameter.getName())
    ),
    restParameters: A.drop(parameters, 1),
    thirdParameterType: getThirdParameterType(declaration.getType(), O.some(declaration), parameterCount),
    dualCall: O.none(),
    callableType: declaration.getType(),
  });
};

const collectVariableCandidate = (
  sourceFile: SourceFile,
  filePath: string,
  owner: string,
  declaration: VariableDeclaration,
  bindings: DualBindingIndex
): O.Option<PublicApiCandidate> => {
  const nameNode = declaration.getNameNode();
  if (!Node.isIdentifier(nameNode) || isExcludedPublicApiName(filePath, nameNode.getText())) {
    return O.none();
  }

  const initializer = declaration.getInitializer();
  const callableType = declaration.getType();
  if (P.isUndefined(initializer) && A.isReadonlyArrayEmpty(callableType.getCallSignatures())) {
    return O.none();
  }

  const dualCall = P.isUndefined(initializer) ? O.none<DualCallInfo>() : getDualCallInfo(initializer, bindings);
  if (P.isUndefined(initializer) || !isFunctionExportInitializer(initializer, dualCall)) {
    return O.none();
  }
  if (isNonHelperCallableValue(initializer, callableType)) {
    return O.none();
  }

  const parameterOwner = P.isUndefined(initializer)
    ? O.none<ParameterOwner>()
    : getInitializerParameterOwner(initializer, dualCall);
  if (
    pipe(
      O.fromNullishOr(declaration.getVariableStatement()),
      O.exists((statement) => isLegitimateConstructorFactory(statement, callableType, parameterOwner))
    )
  ) {
    return O.none();
  }
  const parameterCount = getCallableParameterCount(callableType, parameterOwner, dualCall);
  if (O.isNone(parameterCount) || parameterCount.value < 2) {
    return O.none();
  }

  const position = sourceFile.getLineAndColumnAtPos(nameNode.getStart());
  const parameters = pipe(
    parameterOwner,
    O.map((ownerNode) => ownerNode.getParameters()),
    O.getOrElse(A.empty)
  );
  if (shouldDeferPublicParameterShape(parameters, callableType, parameterCount.value)) {
    return O.none();
  }

  return O.some({
    file: filePath,
    qualifiedName: nameNode.getText(),
    kind: "exported-const-function",
    owner,
    line: position.line,
    column: position.column,
    parameterCount: parameterCount.value,
    firstParameterName: pipe(
      A.get(parameters, 0),
      O.map((parameter) => parameter.getName())
    ),
    restParameters: A.drop(parameters, 1),
    thirdParameterType: getThirdParameterType(callableType, parameterOwner, parameterCount.value),
    dualCall,
    callableType,
  });
};

const isPublicStaticMember = (member: MethodDeclaration | PropertyDeclaration): boolean =>
  member.isStatic() &&
  !member.hasModifier(SyntaxKind.PrivateKeyword) &&
  !member.hasModifier(SyntaxKind.ProtectedKeyword);

const collectStaticMethodCandidate = (
  sourceFile: SourceFile,
  filePath: string,
  owner: string,
  className: string,
  method: MethodDeclaration
): O.Option<PublicApiCandidate> => {
  if (!isPublicStaticMember(method)) {
    return O.none();
  }

  const name = method.getName();
  const qualifiedName = `${className}.${name}`;
  const parameters = method.getParameters();
  if (
    isExcludedPublicApiName(filePath, qualifiedName) ||
    parameters.length < 2 ||
    shouldDeferPublicParameterShape(parameters, method.getType(), parameters.length)
  ) {
    return O.none();
  }

  const position = sourceFile.getLineAndColumnAtPos(method.getNameNode().getStart());
  const parameterCount = parameters.length;
  if (isLegitimateConstructorFactory(method, method.getType(), O.some(method))) {
    return O.none();
  }

  return O.some({
    file: filePath,
    qualifiedName,
    kind: "static-method",
    owner,
    line: position.line,
    column: position.column,
    parameterCount,
    firstParameterName: pipe(
      A.get(parameters, 0),
      O.map((parameter) => parameter.getName())
    ),
    restParameters: A.drop(parameters, 1),
    thirdParameterType: getThirdParameterType(method.getType(), O.some(method), parameterCount),
    dualCall: O.none(),
    callableType: method.getType(),
  });
};

const collectStaticPropertyCandidate = (
  sourceFile: SourceFile,
  filePath: string,
  owner: string,
  className: string,
  property: PropertyDeclaration,
  bindings: DualBindingIndex
): O.Option<PublicApiCandidate> => {
  if (!isPublicStaticMember(property)) {
    return O.none();
  }

  const name = property.getName();
  const qualifiedName = `${className}.${name}`;
  if (isExcludedPublicApiName(filePath, qualifiedName)) {
    return O.none();
  }

  const initializer = property.getInitializer();
  const callableType = property.getType();
  if (P.isUndefined(initializer) && A.isReadonlyArrayEmpty(callableType.getCallSignatures())) {
    return O.none();
  }
  if (!P.isUndefined(initializer) && isNonHelperCallableValue(initializer, callableType)) {
    return O.none();
  }

  const dualCall = P.isUndefined(initializer) ? O.none<DualCallInfo>() : getDualCallInfo(initializer, bindings);
  const parameterOwner = P.isUndefined(initializer)
    ? O.none<ParameterOwner>()
    : getInitializerParameterOwner(initializer, dualCall);
  if (isLegitimateConstructorFactory(property, callableType, parameterOwner)) {
    return O.none();
  }
  const parameterCount = getCallableParameterCount(callableType, parameterOwner, dualCall);
  if (O.isNone(parameterCount) || parameterCount.value < 2) {
    return O.none();
  }

  const position = sourceFile.getLineAndColumnAtPos(property.getNameNode().getStart());
  const parameters = pipe(
    parameterOwner,
    O.map((ownerNode) => ownerNode.getParameters()),
    O.getOrElse(A.empty)
  );
  if (shouldDeferPublicParameterShape(parameters, callableType, parameterCount.value)) {
    return O.none();
  }

  return O.some({
    file: filePath,
    qualifiedName,
    kind: "static-function-property",
    owner,
    line: position.line,
    column: position.column,
    parameterCount: parameterCount.value,
    firstParameterName: pipe(
      A.get(parameters, 0),
      O.map((parameter) => parameter.getName())
    ),
    restParameters: A.drop(parameters, 1),
    thirdParameterType: getThirdParameterType(callableType, parameterOwner, parameterCount.value),
    dualCall,
    callableType,
  });
};

const collectCandidatesForSourceFile = (
  sourceFile: SourceFile,
  filePath: string,
  owner: string
): Readonly<{
  candidates: ReadonlyArray<PublicApiCandidate>;
  excludedLegitimate: number;
}> => {
  const bindings = collectDualBindings(sourceFile);
  let candidates = A.empty<PublicApiCandidate>();
  let excludedLegitimate = 0;

  for (const declaration of sourceFile.getFunctions()) {
    const candidate = collectFunctionCandidate(sourceFile, filePath, owner, declaration);
    if (O.isSome(candidate)) {
      candidates = A.append(candidates, candidate.value);
    } else if (isLegitimateConstructorFunctionDeclaration(filePath, declaration)) {
      excludedLegitimate += 1;
    }
  }

  for (const statement of sourceFile.getVariableStatements()) {
    if (!statement.isExported()) {
      continue;
    }

    for (const declaration of statement.getDeclarations()) {
      const candidate = collectVariableCandidate(sourceFile, filePath, owner, declaration, bindings);
      if (O.isSome(candidate)) {
        candidates = A.append(candidates, candidate.value);
      } else if (isLegitimateConstructorVariableDeclaration(filePath, declaration, bindings)) {
        excludedLegitimate += 1;
      }
    }
  }

  for (const classDeclaration of sourceFile.getClasses()) {
    if (!classDeclaration.isExported()) {
      continue;
    }

    const className = classDeclaration.getName();
    if (P.isUndefined(className)) {
      continue;
    }

    for (const member of classDeclaration.getMembers()) {
      if (Node.isMethodDeclaration(member)) {
        const qualifiedName = `${className}.${member.getName()}`;
        const candidate = collectStaticMethodCandidate(sourceFile, filePath, owner, className, member);
        if (O.isSome(candidate)) {
          candidates = A.append(candidates, candidate.value);
        } else if (isLegitimateConstructorStaticMember(filePath, qualifiedName, member, bindings)) {
          excludedLegitimate += 1;
        }
        continue;
      }

      if (Node.isPropertyDeclaration(member)) {
        const qualifiedName = `${className}.${member.getName()}`;
        const candidate = collectStaticPropertyCandidate(sourceFile, filePath, owner, className, member, bindings);
        if (O.isSome(candidate)) {
          candidates = A.append(candidates, candidate.value);
        } else if (isLegitimateConstructorStaticMember(filePath, qualifiedName, member, bindings)) {
          excludedLegitimate += 1;
        }
      }
    }
  }

  return { candidates, excludedLegitimate };
};

const PERMANENT_EXCLUSIONS: ReadonlyArray<PermanentDualArityExclusion> = [
  {
    file: "packages/agents/server/src/AssistantTurn/ScanState.ts",
    qualifiedName: "scanChunk",
    reason:
      "Fold-step consumed by reference as Stream.mapAccum(() => initialScanState, scanChunk); dual wrapping breaks the higher-order call-site signature.",
  },
] as const;

const isPermanentlyExcludedCandidate = (file: string, qualifiedName: string): boolean =>
  A.some(PERMANENT_EXCLUSIONS, (exclusion) => exclusion.file === file && exclusion.qualifiedName === qualifiedName);

const makeInventoryEntry = (
  candidate: PublicApiCandidate,
  diagnostics: ReadonlyArray<DualArityDiagnosticKind>
): O.Option<DualArityInventoryEntry> => {
  if (A.isReadonlyArrayEmpty(diagnostics) || isPermanentlyExcludedCandidate(candidate.file, candidate.qualifiedName)) {
    return O.none();
  }

  return O.some(
    DualArityInventoryEntry.make({
      file: candidate.file,
      qualifiedName: candidate.qualifiedName,
      kind: candidate.kind,
      status: "candidate",
      owner: candidate.owner,
      reason: DualArityRender.makeReason(diagnostics),
      line: candidate.line,
      column: candidate.column,
      parameterCount: candidate.parameterCount,
      diagnostics,
    })
  );
};

const scanSourceFile = (input: {
  readonly sourceFile: SourceFile;
  readonly filePath: string;
  readonly owner: string;
}): Readonly<{
  readonly entries: ReadonlyArray<DualArityInventoryEntry>;
  readonly excludedLegitimate: number;
}> => {
  const collection = collectCandidatesForSourceFile(input.sourceFile, input.filePath, input.owner);
  let entries = A.empty<DualArityInventoryEntry>();

  for (const candidate of collection.candidates) {
    const entry = makeInventoryEntry(candidate, collectCandidateDiagnostics(candidate));
    if (O.isSome(entry)) {
      entries = A.append(entries, entry.value);
    }
  }

  return { entries, excludedLegitimate: collection.excludedLegitimate };
};

/**
 * Internal ts-morph analysis adapter for the dual-arity law.
 *
 * @example
 * ```ts
 * console.log("DualArityAnalysis")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const DualArityAnalysis = {
  makeOwnerResolver,
  scanSourceFile,
} as const;
