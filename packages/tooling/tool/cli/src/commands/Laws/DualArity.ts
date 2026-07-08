/**
 * Public API dual-arity inventory and enforcement law.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { renderBiomeJson } from "@beep/repo-utils/schemas/BiomeJson";
import { isExcludedTypeScriptSourcePath, toPosixPath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { TSMorphService, TsMorphProjectInspectionRequest } from "@beep/repo-utils/TSMorph/index";
import { resolveWorkspaceDirs } from "@beep/repo-utils/Workspaces";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Console, DateTime, Effect, FileSystem, HashMap, Match, MutableHashSet, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { parse, printParseErrorCode } from "jsonc-parser";
import { Node, SyntaxKind } from "ts-morph";
import { DualArityInventoryReadError } from "./Laws.errors.js";
import type { ParseError } from "jsonc-parser";
import type {
  ArrowFunction,
  CallExpression,
  FunctionDeclaration,
  FunctionExpression,
  MethodDeclaration,
  ParameterDeclaration,
  PropertyDeclaration,
  Signature,
  SourceFile,
  Type,
  VariableDeclaration,
} from "ts-morph";

const $I = $RepoCliId.create("commands/Laws/DualArity");
const INVENTORY_PATH = "standards/dual-arity.inventory.jsonc";
const INCLUDED_GLOBS = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/**/*.ts"] as const;
const ENFORCED_ROOTS = [
  "packages/tooling/tool/cli/src/commands/Laws/DualArity.ts",
  "packages/tooling/library/repo-utils/src/TSMorph/TSMorph.model.ts",
  "packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts",
] as const;
const NON_PIPEABLE_FIRST_PARAMETER_NAMES = ["message", "options", "config", "status", "severity"] as const;
const PIPEABLE_PARAMETER_NAME_PATTERN =
  /^(self|that|value|input|source|effect|schema|cause|request|context|node|project|file|error)$/iu;
const DIRECT_EFFECT_OR_SCHEMA_TYPE_PATTERN =
  /\bEffect\.Effect\b|\bEffect<|\bS\.Schema\b|\bSchema\.Schema\b|\bSchema<|\bPromise\b/iu;
const REACT_HOOK_NAME_PATTERN = /^use[A-Z0-9]/u;
const REACT_COMPONENT_NAME_PATTERN = /^[A-Z]/u;

const DualArityEntryKind = LiteralKit([
  "exported-function",
  "exported-const-function",
  "static-method",
  "static-function-property",
]).pipe(
  $I.annoteSchema("DualArityEntryKind", {
    description: "Kinds of public helper APIs tracked by the dual-arity law.",
  })
);

const DualArityEntryStatus = LiteralKit(["candidate", "exception"]).pipe(
  $I.annoteSchema("DualArityEntryStatus", {
    description: "Tracked status for a dual-arity inventory entry.",
  })
);

const DualArityDiagnosticKind = LiteralKit([
  "missing-dual",
  "invalid-dual-source",
  "invalid-dual-arity",
  "missing-dual-signatures",
  "too-many-positional-params",
  "third-param-not-object-like",
  "obvious-wrong-first-parameter",
]).pipe(
  $I.annoteSchema("DualArityDiagnosticKind", {
    description: "Diagnostic kinds emitted by the public API dual-arity law.",
  })
);

class DualArityInventoryEntry extends S.Class<DualArityInventoryEntry>($I`DualArityInventoryEntry`)(
  {
    file: S.String,
    qualifiedName: S.String,
    kind: DualArityEntryKind,
    status: DualArityEntryStatus,
    owner: S.String,
    reason: S.String,
    issue: S.String.pipe(S.UndefinedOr, S.optionalKey),
    line: S.Finite,
    column: S.Finite,
    parameterCount: S.Finite,
    diagnostics: S.Array(DualArityDiagnosticKind),
  },
  $I.annote("DualArityInventoryEntry", {
    description: "Single tracked public API dual-arity finding.",
  })
) {}

/**
 * Namespace for {@link DualArityInventoryEntry} companion types.
 *
 * @example
 * ```ts
 * console.log("DualArityInventoryEntry")
 * ```
 * @category models
 * @since 0.0.0
 */
export declare namespace DualArityInventoryEntry {
  /**
   * Encoded representation of {@link DualArityInventoryEntry}.
   *
   * @example
   * ```ts
   * console.log("Encoded")
   * ```
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof DualArityInventoryEntry.Encoded;
}

class DualArityInventoryDocument extends S.Class<DualArityInventoryDocument>($I`DualArityInventoryDocument`)(
  {
    version: S.Literal(1),
    generatedOn: S.String,
    scope: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.fromIterable(INCLUDED_GLOBS))),
      S.withDecodingDefault(Effect.succeed(A.fromIterable(INCLUDED_GLOBS)))
    ),
    enforcedRoots: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.fromIterable(ENFORCED_ROOTS))),
      S.withDecodingDefault(Effect.succeed(A.fromIterable(ENFORCED_ROOTS)))
    ),
    entries: S.Array(DualArityInventoryEntry).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<DualArityInventoryEntry>())),
      S.withDecodingDefault(Effect.succeed(A.empty<DualArityInventoryEntry.Encoded>()))
    ),
  },
  $I.annote("DualArityInventoryDocument", {
    description: "Committed public API dual-arity inventory baseline for repo-wide Effect governance.",
  })
) {}

/**
 * Runtime options for public API dual-arity enforcement.
 *
 * @example
 * ```ts
 * console.log("DualArityRulesOptions")
 * ```
 * @category models
 * @since 0.0.0
 */
export class DualArityRulesOptions extends S.Class<DualArityRulesOptions>($I`DualArityRulesOptions`)(
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
  },
  $I.annote("DualArityRulesOptions", {
    description: "Runtime options for public API dual-arity enforcement.",
  })
) {}

/**
 * Summary of public API dual-arity inventory verification.
 *
 * @example
 * ```ts
 * console.log("DualArityRulesSummary")
 * ```
 * @category models
 * @since 0.0.0
 */
export class DualArityRulesSummary extends S.Class<DualArityRulesSummary>($I`DualArityRulesSummary`)(
  {
    liveEntries: S.Finite,
    trackedEntries: S.Finite,
    missingEntries: S.Finite,
    staleEntries: S.Finite,
    enforcedCandidates: S.Finite,
    invalidExceptions: S.Finite,
    excludedLegitimate: S.Finite,
    wroteInventory: S.Boolean,
    strictFailure: S.Boolean,
    diagnostics: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
  },
  $I.annote("DualArityRulesSummary", {
    description: "Summary of public API dual-arity inventory verification.",
  })
) {}

type ParameterOwner = ArrowFunction | FunctionDeclaration | FunctionExpression | MethodDeclaration;

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
  readonly kind: typeof DualArityEntryKind.Type;
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

type DualArityScanResult = Readonly<{
  document: DualArityInventoryDocument;
  excludedLegitimate: number;
}>;

const decodeInventoryDocument = S.decodeUnknownEffect(DualArityInventoryDocument);
const encodeInventoryDocument = S.encodeUnknownEffect(DualArityInventoryDocument);
const decodeProjectInspectionRequest = S.decodeUnknownEffect(TsMorphProjectInspectionRequest);

const makeEntryKey = (entry: DualArityInventoryEntry): string => `${entry.file}::${entry.qualifiedName}::${entry.kind}`;

const byEntryKeyAscending: Order.Order<DualArityInventoryEntry> = Order.mapInput(Order.String, makeEntryKey);

const byWorkspacePathLengthDescending: Order.Order<readonly [string, string]> = Order.mapInput(
  Order.Number,
  (entry) => -entry[1].length
);

const sortEntries = (entries: ReadonlyArray<DualArityInventoryEntry>): ReadonlyArray<DualArityInventoryEntry> =>
  A.sort(entries, byEntryKeyAscending);

const todayYmd = (): string => {
  const now = DateTime.nowUnsafe();
  const year = `${DateTime.getPartUtc(now, "year")}`;
  const month = Str.padStart(2, "0")(`${DateTime.getPartUtc(now, "month")}`);
  const day = Str.padStart(2, "0")(`${DateTime.getPartUtc(now, "day")}`);
  return `${year}-${month}-${day}`;
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

const isExcludedFile = (excludePaths: MutableHashSet.MutableHashSet<string>, filePath: string): boolean => {
  const normalized = toPosixPath(filePath);
  return MutableHashSet.has(excludePaths, normalized) || isExcludedTypeScriptSourcePath(normalized);
};

const isEnforcedFile = (document: DualArityInventoryDocument, filePath: string): boolean =>
  A.some(document.enforcedRoots, (root) => filePath === root || Str.startsWith(`${root}/`)(filePath));

const diagnosticMessage = (diagnostic: typeof DualArityDiagnosticKind.Type): string =>
  Match.value(diagnostic).pipe(
    Match.when(
      "missing-dual",
      () => "Public 2-3 parameter helper APIs must be implemented with dual from effect/Function."
    ),
    Match.when("invalid-dual-source", () => "dual must be imported directly or as a namespace from effect/Function."),
    Match.when("invalid-dual-arity", () => "dual arity must match the public positional arity and may not exceed 3."),
    Match.when(
      "missing-dual-signatures",
      () => "Public type must expose both data-first and data-last call signatures."
    ),
    Match.when(
      "too-many-positional-params",
      () => "Public helper APIs may not expose more than 3 positional parameters."
    ),
    Match.when(
      "third-param-not-object-like",
      () => "Public 3-parameter helper APIs must use a strict ObjectLike third parameter."
    ),
    Match.when(
      "obvious-wrong-first-parameter",
      () => "The first parameter appears to be configuration/status text while a later parameter is pipeable."
    ),
    Match.exhaustive
  );

const makeReason = (diagnostics: ReadonlyArray<typeof DualArityDiagnosticKind.Type>): string =>
  A.join(A.map(diagnostics, diagnosticMessage), " ");

const parseNumericLiteral = (node: import("ts-morph").Node): O.Option<number> =>
  Node.isNumericLiteral(node) ? O.some(Number.parseInt(node.getText(), 10)) : O.none();

const unwrapExpression = (node: import("ts-morph").Node): import("ts-morph").Node => {
  let current = node;
  while (
    Node.isParenthesizedExpression(current) ||
    Node.isAsExpression(current) ||
    Node.isTypeAssertion(current) ||
    Node.isSatisfiesExpression(current) ||
    Node.isNonNullExpression(current)
  ) {
    current = current.getExpression();
  }
  return current;
};

const isParameterOwner = (node: import("ts-morph").Node): node is ParameterOwner =>
  Node.isArrowFunction(node) ||
  Node.isFunctionDeclaration(node) ||
  Node.isFunctionExpression(node) ||
  Node.isMethodDeclaration(node);

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
  /^(?:S|Schema)\.(?:(?:decode|encode)(?:Unknown)?(?:Effect|Exit|Option|Promise|Result|Sync)|toEquivalence)$/u;

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

const getTypeSignatureParameterCount = (type: Type): O.Option<number> => {
  const signatures = A.filter(type.getCallSignatures(), (signature) => !isTaggedTemplateSignature(signature));
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

const shouldDeferPublicParameterShape = (
  parameters: ReadonlyArray<ParameterDeclaration>,
  callableType: Type,
  parameterCount: number
): boolean => hasDeferredPublicParameterShape(parameters) && !hasDualSignatures(callableType, parameterCount);

const getParameterDeclaration = (signature: Signature, index: number): O.Option<ParameterDeclaration> =>
  pipe(
    A.get(signature.getParameters(), index),
    O.flatMap((parameter) => O.fromNullishOr(parameter.getValueDeclaration())),
    O.filter(Node.isParameterDeclaration)
  );

const isTaggedTemplateSignature = (signature: Signature): boolean => {
  const firstParameter = getParameterDeclaration(signature, 0);
  const firstParameterTypeText = pipe(
    firstParameter,
    O.map((parameter) => parameter.getType().getText())
  );

  return (
    O.exists(firstParameterTypeText, (typeText) => Str.includes("TemplateStringsArray")(typeText)) &&
    pipe(
      A.drop(signature.getParameters(), 1),
      A.some((parameter) =>
        pipe(
          O.fromNullishOr(parameter.getValueDeclaration()),
          O.filter(Node.isParameterDeclaration),
          O.exists((declaration) => declaration.isRestParameter())
        )
      )
    )
  );
};

const getNonTemplateCallSignatures = (type: Type): ReadonlyArray<Signature> =>
  A.filter(type.getCallSignatures(), (signature) => !isTaggedTemplateSignature(signature));

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

const isPrimitiveType = (type: Type): boolean =>
  type.isString() ||
  type.isNumber() ||
  type.isBoolean() ||
  type.isBigInt() ||
  type.isStringLiteral() ||
  type.isNumberLiteral() ||
  type.isBooleanLiteral() ||
  type.isNull() ||
  type.isUndefined() ||
  type.isVoid();

const isOptionalTypeMarker = (type: Type): boolean => type.isUndefined() || type.isNull();

const isCallableType = (type: Type): boolean => !A.isReadonlyArrayEmpty(type.getCallSignatures());

const isStrictObjectLikeType = (type: Type): boolean => {
  if (type.isTypeParameter()) {
    const constraint = type.getConstraint();
    return P.isNotUndefined(constraint) && isStrictObjectLikeType(constraint);
  }

  if (
    type.isAny() ||
    type.isUnknown() ||
    type.isArray() ||
    type.isReadonlyArray() ||
    type.isTuple() ||
    isPrimitiveType(type) ||
    type.getCallSignatures().length > 0
  ) {
    return false;
  }

  const typeText = type.getText();
  if (DIRECT_EFFECT_OR_SCHEMA_TYPE_PATTERN.test(typeText)) {
    return false;
  }

  if (type.isUnion()) {
    const objectLikeMembers = A.filter(type.getUnionTypes(), (member) => !isOptionalTypeMarker(member));

    return !A.isReadonlyArrayEmpty(objectLikeMembers) && A.every(objectLikeMembers, isStrictObjectLikeType);
  }

  if (type.isIntersection()) {
    return A.some(type.getIntersectionTypes(), isStrictObjectLikeType);
  }

  return (
    type.isObject() ||
    type.isClassOrInterface() ||
    !A.isReadonlyArrayEmpty(type.getProperties()) ||
    P.isNotUndefined(type.getStringIndexType())
  );
};

const hasJSDocCategory = (node: import("ts-morph").Node, category: string): boolean => {
  if (!Node.isJSDocable(node)) {
    return false;
  }

  const jsDocText = pipe(
    node.getJsDocs(),
    A.map((jsDoc) => jsDoc.getText()),
    A.join("\n")
  );

  return Str.includes(`@category ${category}`)(jsDocText);
};

// R12: an all-methods-record return type (e.g. `makeChatOperations`'s
// `{ listThreads: (...) => Effect.Effect<...>; createThread: (...) => ...;
// ... }`) is a legitimate tagged-constructor-factory return shape. Checked
// via each property's OWN resolved type (not the return type's printed
// text), so it never runs into DIRECT_EFFECT_OR_SCHEMA_TYPE_PATTERN's
// false-positive substring match against a member's nested `Effect.Effect<`
// signature (see isFactoryReturnType below).
const isAllMethodMembersObjectType = (type: Type, contextNode: import("ts-morph").Node): boolean => {
  const properties = type.getProperties();
  return (
    !A.isReadonlyArrayEmpty(properties) &&
    A.isReadonlyArrayEmpty(type.getCallSignatures()) &&
    A.every(
      properties,
      (property) => !A.isReadonlyArrayEmpty(property.getTypeAtLocation(contextNode).getCallSignatures())
    )
  );
};

// R12 diagnosed conjunct: DIRECT_EFFECT_OR_SCHEMA_TYPE_PATTERN.test(typeText)
// tests the FULL printed text of the return type, which for an object
// return type includes every member's own signature text. A record whose
// methods return `Effect.Effect<...>` (e.g. makeChatOperations's
// ChatOperations return type) therefore matched the pattern via substring
// and was rejected before ever reaching isStrictObjectLikeType — the fix is
// isAllMethodMembersObjectType above, checked first and bypassing the
// textual pattern entirely for that shape.
const isFactoryReturnType = (type: Type, contextNode: import("ts-morph").Node): boolean => {
  if (isAllMethodMembersObjectType(type, contextNode)) {
    return true;
  }

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
  hasJSDocCategory(docNode, "constructors") &&
  hasMultiParameterCallableShape(callableType, parameterOwner) &&
  A.some(callableType.getCallSignatures(), (signature) => isFactoryReturnType(signature.getReturnType(), docNode));

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

const collectCandidateDiagnostics = (
  candidate: PublicApiCandidate
): ReadonlyArray<typeof DualArityDiagnosticKind.Type> => {
  let diagnostics = A.empty<typeof DualArityDiagnosticKind.Type>();
  const dualCall = candidate.dualCall;
  const dualArity = pipe(
    dualCall,
    O.flatMap((info) => info.arity)
  );
  const hasPredicateDualWithPublicDualShape =
    O.isSome(dualCall) && O.isNone(dualArity) && hasDualSignatures(candidate.callableType, candidate.parameterCount);
  const hasMatchingDualArity =
    O.exists(dualArity, (arity) => arity === candidate.parameterCount) || hasPredicateDualWithPublicDualShape;

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

  const hasValidDualWithCallableThirdParameter =
    O.isSome(dualCall) &&
    dualCall.value.validSource &&
    hasMatchingDualArity &&
    pipe(candidate.thirdParameterType, O.exists(isCallableType));

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
  const workspaces = yield* resolveWorkspaceDirs(process.cwd()).pipe(
    Effect.option,
    Effect.map(O.getOrElse(() => HashMap.empty<string, string>()))
  );
  const workspaceEntries = pipe(
    HashMap.toEntries(workspaces),
    A.map(([packageName, absolutePath]) => [packageName, toPosixPath(absolutePath)] as const),
    A.sort(byWorkspacePathLengthDescending)
  );
  const cwd = toPosixPath(process.cwd());

  return (absoluteFilePath: string): string => {
    const normalized = toPosixPath(absoluteFilePath);
    const relativePath = toPosixPath(Str.replace(`${cwd}/`, "")(normalized));
    const workspaceMatch = A.findFirst(
      workspaceEntries,
      ([, workspacePath]) => normalized === workspacePath || Str.startsWith(`${workspacePath}/`)(normalized)
    );
    if (O.isSome(workspaceMatch)) {
      return workspaceMatch.value[0];
    }
    if (Str.startsWith("packages/tooling/tool/cli/")(relativePath)) {
      return "@beep/repo-cli";
    }
    if (Str.startsWith("packages/tooling/library/repo-utils/")(relativePath)) {
      return "@beep/repo-utils";
    }
    if (Str.startsWith("infra/")(relativePath)) {
      return "@beep/infra";
    }
    return "@beep/root";
  };
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
  if (
    !A.isReadonlyArrayEmpty(parameters) &&
    shouldDeferPublicParameterShape(parameters, callableType, parameterCount.value)
  ) {
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
  if (
    !A.isReadonlyArrayEmpty(parameters) &&
    shouldDeferPublicParameterShape(parameters, callableType, parameterCount.value)
  ) {
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

type PermanentDualArityExclusion = {
  readonly file: string;
  readonly qualifiedName: string;
  readonly reason: string;
};

// R12: driver-verified holds where a mechanical dual() wrap provably breaks
// a real call site, baked directly into the detector (stronger than a
// standards/dual-arity.inventory.jsonc exception record — this file is
// itself one of ENFORCED_ROOTS) instead of a standing tracked exception.
const PERMANENT_EXCLUSIONS: ReadonlyArray<PermanentDualArityExclusion> = [
  {
    file: "packages/agents/server/src/AssistantTurn/ScanState.ts",
    qualifiedName: "scanChunk",
    reason:
      "Fold-step consumed BY REFERENCE as Stream.mapAccum(() => initialScanState, scanChunk) (AnthropicTurnKernel.ts:143). A dual(2, ...) wrap breaks TypeScript overload resolution when the function is handed to a generic higher-order combinator positionally rather than invoked directly — driver-verified clean-before/broken-after compile diff (ops/reports/P2-audits/p2-d5d8.md, ruling R12).",
  },
] as const;

const isPermanentlyExcludedCandidate = (file: string, qualifiedName: string): boolean =>
  A.some(PERMANENT_EXCLUSIONS, (exclusion) => exclusion.file === file && exclusion.qualifiedName === qualifiedName);

const makeInventoryEntry = (
  candidate: PublicApiCandidate,
  diagnostics: ReadonlyArray<typeof DualArityDiagnosticKind.Type>
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
      reason: makeReason(diagnostics),
      line: candidate.line,
      column: candidate.column,
      parameterCount: candidate.parameterCount,
      diagnostics,
    })
  );
};

const readInventoryDocument = Effect.fn(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(process.cwd(), INVENTORY_PATH);

  if (!(yield* fs.exists(absolutePath))) {
    return O.none<DualArityInventoryDocument>();
  }

  const content = yield* fs.readFileString(absolutePath);
  const parseErrors = A.empty<ParseError>();
  const parsed = parse(content, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (!A.isReadonlyArrayEmpty(parseErrors)) {
    return yield* DualArityInventoryReadError.new(
      pipe(
        parseErrors,
        A.map((error) => `${printParseErrorCode(error.error)}@${error.offset}:${error.length}`),
        A.join(", "),
        (details) => `Unable to parse ${INVENTORY_PATH}: ${details}`
      )
    );
  }

  return yield* decodeInventoryDocument(parsed).pipe(Effect.map(O.some));
});

const writeInventoryDocument = Effect.fn("DualArity.writeInventoryDocument")(function* (
  document: DualArityInventoryDocument
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(process.cwd(), INVENTORY_PATH);
  const encodedDocument = yield* encodeInventoryDocument(document);
  const serialized = yield* renderBiomeJson(absolutePath, encodedDocument);
  yield* fs.makeDirectory(path.dirname(absolutePath), { recursive: true });
  yield* fs.writeFileString(absolutePath, serialized);
});

const scanDualArityInventory = Effect.fn("DualArity.scanDualArityInventory")(function* (
  options: DualArityRulesOptions
) {
  const service = yield* TSMorphService;
  const path = yield* Path.Path;
  const ownerResolver = yield* makeOwnerResolver();
  const excludePaths = MutableHashSet.empty<string>();
  for (const excludePath of options.excludePaths) {
    MutableHashSet.add(excludePaths, toPosixPath(excludePath));
  }

  const request = yield* decodeProjectInspectionRequest({
    entrypoint: {
      _tag: "tsconfig",
      tsConfigPath: "tsconfig.json",
    },
    repoRootPath: null,
    mode: "semantic",
    referencePolicy: "workspaceOnly",
    filePaths: A.empty(),
    sourceFileGlobs: A.fromIterable(INCLUDED_GLOBS),
  });
  const scanResult = yield* service.inspectProject(request, ({ scope, sourceFiles }) => {
    let liveEntries = A.empty<DualArityInventoryEntry>();
    let excludedLegitimate = 0;

    for (const sourceFile of sourceFiles) {
      const filePath = toPosixPath(path.relative(scope.repoRootPath, sourceFile.getFilePath()));
      if (isExcludedFile(excludePaths, filePath)) {
        continue;
      }

      const owner = ownerResolver(sourceFile.getFilePath());
      const collection = collectCandidatesForSourceFile(sourceFile, filePath, owner);
      excludedLegitimate += collection.excludedLegitimate;
      for (const candidate of collection.candidates) {
        const entry = makeInventoryEntry(candidate, collectCandidateDiagnostics(candidate));
        if (O.isSome(entry)) {
          liveEntries = A.append(liveEntries, entry.value);
        }
      }
    }

    return {
      entries: sortEntries(A.dedupeWith(liveEntries, (left, right) => makeEntryKey(left) === makeEntryKey(right))),
      excludedLegitimate,
    };
  });

  return {
    document: DualArityInventoryDocument.make({
      version: 1,
      generatedOn: todayYmd(),
      scope: A.fromIterable(INCLUDED_GLOBS),
      enforcedRoots: A.fromIterable(ENFORCED_ROOTS),
      entries: scanResult.entries,
    }),
    excludedLegitimate: scanResult.excludedLegitimate,
  } satisfies DualArityScanResult;
});

const mergeInventory = (
  liveDocument: DualArityInventoryDocument,
  existingDocument: O.Option<DualArityInventoryDocument>
): DualArityInventoryDocument => {
  const existingByKey = pipe(
    existingDocument,
    O.map((document) =>
      HashMap.fromIterable(
        A.map(document.entries, (entry): readonly [string, DualArityInventoryEntry] => [makeEntryKey(entry), entry])
      )
    ),
    O.getOrElse(HashMap.empty<string, DualArityInventoryEntry>)
  );

  const mergedEntries = pipe(
    liveDocument.entries,
    A.map((entry) => {
      const existingEntry = HashMap.get(existingByKey, makeEntryKey(entry));
      if (O.isNone(existingEntry)) {
        return entry;
      }

      return DualArityInventoryEntry.make({
        ...entry,
        status: existingEntry.value.status,
        owner: existingEntry.value.owner,
        reason: existingEntry.value.reason,
        issue: existingEntry.value.issue,
      });
    })
  );

  return DualArityInventoryDocument.make({
    version: 1,
    generatedOn: liveDocument.generatedOn,
    scope: liveDocument.scope,
    enforcedRoots: pipe(
      existingDocument,
      O.map((document) => document.enforcedRoots),
      O.getOrElse(() => liveDocument.enforcedRoots)
    ),
    entries: sortEntries(mergedEntries),
  });
};

const getInvalidExceptions = (document: DualArityInventoryDocument): ReadonlyArray<DualArityInventoryEntry> =>
  A.filter(
    document.entries,
    (entry) =>
      entry.status === "exception" && (Str.isEmpty(Str.trim(entry.owner)) || Str.isEmpty(Str.trim(entry.reason)))
  );

const makeMissingDiagnostics = (entries: ReadonlyArray<DualArityInventoryEntry>): ReadonlyArray<string> =>
  A.map(
    entries,
    (entry) =>
      `[missing] ${entry.file}:${entry.line}:${entry.column} ${entry.qualifiedName} [${entry.kind}] (${A.join(", ")(
        entry.diagnostics
      )}) ${entry.reason}`
  );

const makeStaleDiagnostics = (entries: ReadonlyArray<DualArityInventoryEntry>): ReadonlyArray<string> =>
  A.map(entries, (entry) => `[stale] ${entry.file} ${entry.qualifiedName} [${entry.kind}]`);

const makeEnforcedDiagnostics = (entries: ReadonlyArray<DualArityInventoryEntry>): ReadonlyArray<string> =>
  A.map(
    entries,
    (entry) =>
      `[enforced] ${entry.file}:${entry.line}:${entry.column} ${entry.qualifiedName} [${entry.kind}] (${A.join(", ")(
        entry.diagnostics
      )}) ${entry.reason}`
  );

const makeInvalidExceptionDiagnostics = (entries: ReadonlyArray<DualArityInventoryEntry>): ReadonlyArray<string> =>
  A.map(
    entries,
    (entry) => `[invalid-exception] ${entry.file} ${entry.qualifiedName} [${entry.kind}] owner and reason are required`
  );

/**
 * Run public API dual-arity inventory verification.
 *
 * @example
 * ```ts
 * console.log("runDualArityRules")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const runDualArityRules = Effect.fn("runDualArityRules")(function* (options: DualArityRulesOptions) {
  const liveScan = yield* scanDualArityInventory(options);
  const liveDocument = liveScan.document;
  const existingDocument = yield* readInventoryDocument();
  const mergedDocument = mergeInventory(liveDocument, existingDocument);

  const liveByKey = HashMap.fromIterable(
    A.map(liveDocument.entries, (entry): readonly [string, DualArityInventoryEntry] => [makeEntryKey(entry), entry])
  );
  const trackedByKey = pipe(
    existingDocument,
    O.map((document) =>
      HashMap.fromIterable(
        A.map(document.entries, (entry): readonly [string, DualArityInventoryEntry] => [makeEntryKey(entry), entry])
      )
    ),
    O.getOrElse(HashMap.empty<string, DualArityInventoryEntry>)
  );

  const missingEntries = A.filter(liveDocument.entries, (entry) => !HashMap.has(trackedByKey, makeEntryKey(entry)));
  const staleEntries = pipe(
    O.map(existingDocument, (document) =>
      A.filter(document.entries, (entry) => !HashMap.has(liveByKey, makeEntryKey(entry)))
    ),
    O.getOrElse(A.empty<DualArityInventoryEntry>)
  );
  const enforcedCandidates = A.filter(
    mergedDocument.entries,
    (entry) => entry.status === "candidate" && isEnforcedFile(mergedDocument, entry.file)
  );
  const invalidExceptions = getInvalidExceptions(mergedDocument);

  if (options.write) {
    yield* writeInventoryDocument(mergedDocument);
  }

  const diagnostics = pipe(
    A.empty<string>(),
    A.appendAll(makeMissingDiagnostics(missingEntries)),
    A.appendAll(makeStaleDiagnostics(staleEntries)),
    A.appendAll(makeEnforcedDiagnostics(enforcedCandidates)),
    A.appendAll(makeInvalidExceptionDiagnostics(invalidExceptions))
  );

  const strictFailure = options.write
    ? !A.isReadonlyArrayEmpty(enforcedCandidates) || !A.isReadonlyArrayEmpty(invalidExceptions)
    : options.strictCheck &&
      (!A.isReadonlyArrayEmpty(missingEntries) ||
        !A.isReadonlyArrayEmpty(staleEntries) ||
        !A.isReadonlyArrayEmpty(enforcedCandidates) ||
        !A.isReadonlyArrayEmpty(invalidExceptions));

  yield* Console.log(`[dual-arity] live_entries=${liveDocument.entries.length}`);
  yield* Console.log(`[dual-arity] tracked_entries=${mergedDocument.entries.length}`);
  yield* Console.log(`[dual-arity] missing_entries=${missingEntries.length}`);
  yield* Console.log(`[dual-arity] stale_entries=${staleEntries.length}`);
  yield* Console.log(`[dual-arity] enforced_candidates=${enforcedCandidates.length}`);
  yield* Console.log(`[dual-arity] invalid_exceptions=${invalidExceptions.length}`);
  yield* Console.log(`[dual-arity] excluded_legitimate=${liveScan.excludedLegitimate}`);
  if (options.write) {
    yield* Console.log(`[dual-arity] wrote ${INVENTORY_PATH}`);
  }

  for (const diagnostic of diagnostics) {
    yield* Console.error(`[dual-arity] ${diagnostic}`);
  }

  return DualArityRulesSummary.make({
    liveEntries: liveDocument.entries.length,
    trackedEntries: mergedDocument.entries.length,
    missingEntries: missingEntries.length,
    staleEntries: staleEntries.length,
    enforcedCandidates: enforcedCandidates.length,
    invalidExceptions: invalidExceptions.length,
    excludedLegitimate: liveScan.excludedLegitimate,
    wroteInventory: options.write,
    strictFailure,
    diagnostics,
  });
});
