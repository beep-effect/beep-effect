/**
 * Repo-local no-native-runtime parity checker.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import {
  getAllowlistDiagnostics,
  getAllowlistEntries,
  isViolationAllowlisted,
} from "@beep/repo-configs/eslint/EffectLawsAllowlist";
import {
  isNoNativeRuntimeErrorFile,
  isNoNativeRuntimeExtraCheckHotspot,
} from "@beep/repo-configs/eslint/NoNativeRuntimeHotspots";
import { toPosixPath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect, HashSet, Inspectable, Match, Order, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Node, Project } from "ts-morph";
import { isExcludedLawScanPath } from "./internal/LawScan.ts";
import { NoNativeRuntimeRulesExecutionError } from "./Laws.errors.ts";
import type {
  BinaryExpression,
  CallExpression,
  ImportDeclaration,
  NewExpression,
  SourceFile,
  SwitchStatement,
} from "ts-morph";

const $I = $RepoCliId.create("commands/Laws/NoNativeRuntime");

const INCLUDED_GLOBS = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/**/*.ts"] as const;
const SOURCE_FILE_GLOBS = [...INCLUDED_GLOBS, "!**/docs/**"] as const;
const ALLOWLIST_PATH = "standards/effect-laws.allowlist.jsonc";
const NO_NATIVE_RUNTIME_RULE_ID = "beep-laws/no-native-runtime";

const OBJECT_METHODS = HashSet.fromIterable([
  "keys",
  "values",
  "entries",
  "fromEntries",
  "assign",
  "hasOwn",
  "freeze",
  "seal",
  "create",
]);
const DATE_METHODS = HashSet.fromIterable(["now", "parse", "UTC"]);
const ARRAY_STATIC_METHODS = HashSet.fromIterable(["from", "isArray", "of"]);
const MAP_SET_CTORS = HashSet.fromIterable(["Map", "Set", "WeakMap", "WeakSet"]);
const PLATFORM_AVAILABILITY_GLOBALS = HashSet.fromIterable([
  "document",
  "localStorage",
  "navigator",
  "sessionStorage",
  "window",
]);
const NATIVE_ERROR_CTORS = HashSet.fromIterable([
  "AggregateError",
  "Error",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError",
]);
const NODE_RUNTIME_IMPORTS = HashSet.fromIterable(["node:fs", "node:path", "node:child_process"]);
const STRING_METHODS = HashSet.fromIterable(["split", "trim", "startsWith", "endsWith"]);
const EQUALITY_OPERATORS = HashSet.fromIterable(["===", "==", "!==", "!="]);
const TYPEOF_RUNTIME_LITERALS = HashSet.fromIterable([
  "string",
  "number",
  "boolean",
  "object",
  "function",
  "undefined",
  "symbol",
  "bigint",
]);

/**
 * Runtime options for repo-local native runtime checks.
 *
 * **Example** (Configure native-runtime scanning)
 * ```ts
 * console.log("NoNativeRuntimeRulesOptions")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NoNativeRuntimeRulesOptions extends S.Class<NoNativeRuntimeRulesOptions>($I`NoNativeRuntimeRulesOptions`)(
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
  $I.annote("NoNativeRuntimeRulesOptions", {
    description: "Runtime options for repo-local native runtime checks.",
  })
) {}

const NoNativeRuntimeSeverity = LiteralKit(["warn", "error"]);

/**
 * Single repo-local native runtime diagnostic.
 *
 * @example
 * ```ts
 * console.log("NoNativeRuntimeDiagnostic")
 * ```
 * @category models
 * @since 0.0.0
 */
export class NoNativeRuntimeDiagnostic extends S.Class<NoNativeRuntimeDiagnostic>($I`NoNativeRuntimeDiagnostic`)(
  {
    severity: NoNativeRuntimeSeverity,
    file: S.String,
    line: S.Finite,
    column: S.Finite,
    message: S.String,
    messageId: S.String.pipe(S.UndefinedOr, S.optionalKey),
  },
  $I.annote("NoNativeRuntimeDiagnostic", {
    description: "Single repo-local native runtime diagnostic.",
  })
) {}

/**
 * Namespace for {@link NoNativeRuntimeDiagnostic} companion types.
 *
 * @example
 * ```ts
 * console.log("NoNativeRuntimeDiagnostic")
 * ```
 * @category models
 * @since 0.0.0
 */
export declare namespace NoNativeRuntimeDiagnostic {
  /**
   * Encoded representation of {@link NoNativeRuntimeDiagnostic}.
   *
   * @example
   * ```ts
   * console.log("Encoded")
   * ```
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof NoNativeRuntimeDiagnostic.Encoded;
}

/**
 * Summary of repo-local native runtime checks.
 *
 * @example
 * ```ts
 * console.log("NoNativeRuntimeRulesSummary")
 * ```
 * @category models
 * @since 0.0.0
 */
export class NoNativeRuntimeRulesSummary extends S.Class<NoNativeRuntimeRulesSummary>($I`NoNativeRuntimeRulesSummary`)(
  {
    scannedFiles: S.Finite,
    touchedFiles: S.Finite,
    warningCount: S.Finite,
    errorCount: S.Finite,
    strictFailure: S.Boolean,
    affectedFiles: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    allowlistedCount: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefault(Effect.succeed(0))
    ),
    unusedAllowlistEntries: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    diagnostics: S.Array(NoNativeRuntimeDiagnostic).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<NoNativeRuntimeDiagnostic>())),
      S.withDecodingDefault(Effect.succeed(A.empty<NoNativeRuntimeDiagnostic.Encoded>()))
    ),
  },
  $I.annote("NoNativeRuntimeRulesSummary", {
    description: "Summary of repo-local native runtime checks.",
  })
) {}

/**
 * Options for collecting native-runtime allowlist lookup keys.
 *
 * @example
 * ```ts
 * console.log("NativeRuntimeViolationKeyOptions")
 * ```
 * @category models
 * @since 0.0.0
 */
export class NativeRuntimeViolationKeyOptions extends S.Class<NativeRuntimeViolationKeyOptions>(
  $I`NativeRuntimeViolationKeyOptions`
)(
  {
    relativeFilePath: S.String,
    inHotspotScope: S.Boolean,
  },
  $I.annote("NativeRuntimeViolationKeyOptions", {
    description: "Options for collecting native-runtime allowlist lookup keys.",
  })
) {}

type MemberCall = readonly [string, string];

type ViolationData = Readonly<Record<string, string>>;

type NativeRuntimeViolation = Readonly<{
  kind: string;
  messageId: string;
  node: import("ts-morph").Node;
  data?: undefined | ViolationData;
}>;

type ScannedSourceFile = readonly [string, SourceFile];

const byScannedSourceFilePathAscending: Order.Order<ScannedSourceFile> = Order.mapInput(
  Order.String,
  ([relativeFilePath]) => relativeFilePath
);

const makeViolation = (
  node: import("ts-morph").Node,
  kind: string,
  messageId: string,
  data?: ViolationData
): NativeRuntimeViolation => (P.isUndefined(data) ? { kind, messageId, node } : { kind, messageId, node, data });

const makeAllowlistKey = (filePath: string, kind: string): string =>
  `${NO_NATIVE_RUNTIME_RULE_ID}::${toPosixPath(filePath)}::${kind}`;

const getMemberCall = (node: import("ts-morph").Node): O.Option<MemberCall> => {
  if (Node.isPropertyAccessExpression(node)) {
    const objectNode = node.getExpression();
    if (!Node.isIdentifier(objectNode)) {
      return O.none();
    }
    return O.some<MemberCall>([objectNode.getText(), node.getName()]);
  }

  if (Node.isElementAccessExpression(node)) {
    const objectNode = node.getExpression();
    const argumentNode = node.getArgumentExpression();

    if (!Node.isIdentifier(objectNode) || argumentNode === undefined || !Node.isStringLiteral(argumentNode)) {
      return O.none();
    }

    return O.some<MemberCall>([objectNode.getText(), argumentNode.getLiteralValue()]);
  }

  return O.none();
};

const getRuntimeTypeLiteral = (node: import("ts-morph").Node): O.Option<string> => {
  if (!Node.isStringLiteral(node)) {
    return O.none();
  }

  const value = node.getLiteralValue();
  return HashSet.has(TYPEOF_RUNTIME_LITERALS, value) ? O.some(value) : O.none();
};

const getTypeofIdentifierName = (node: import("ts-morph").Node): O.Option<string> => {
  if (!Node.isTypeOfExpression(node)) {
    return O.none();
  }

  const expression = node.getExpression();
  return Node.isIdentifier(expression) ? O.some(expression.getText()) : O.none();
};

const isPlatformAvailabilityGuard = (typeofNode: import("ts-morph").Node, literal: O.Option<string>): boolean =>
  O.exists(literal, (value) => value === "undefined") &&
  pipe(
    getTypeofIdentifierName(typeofNode),
    O.exists((identifierName) => HashSet.has(PLATFORM_AVAILABILITY_GLOBALS, identifierName))
  );

const isIgnoredPlatformTypeofComparison = (
  typeofCandidate: import("ts-morph").Node,
  literalCandidate: import("ts-morph").Node
): boolean =>
  Node.isTypeOfExpression(typeofCandidate) &&
  isPlatformAvailabilityGuard(typeofCandidate, getRuntimeTypeLiteral(literalCandidate));

const hasRuntimeTypeofComparison = (
  typeofCandidate: import("ts-morph").Node,
  literalCandidate: import("ts-morph").Node
): boolean => Node.isTypeOfExpression(typeofCandidate) && O.isSome(getRuntimeTypeLiteral(literalCandidate));

const detectImportViolation = (node: ImportDeclaration, inHotspotScope: boolean): O.Option<NativeRuntimeViolation> => {
  if (!inHotspotScope) {
    return O.none();
  }

  const moduleName = node.getModuleSpecifierValue();
  return HashSet.has(NODE_RUNTIME_IMPORTS, moduleName)
    ? O.some(makeViolation(node, "node-runtime-import", "nodeRuntimeImport", { moduleName }))
    : O.none();
};

const detectNewExpressionViolation = (node: NewExpression): O.Option<NativeRuntimeViolation> => {
  const expression = node.getExpression();

  if (Node.isIdentifier(expression)) {
    const constructorName = expression.getText();

    if (HashSet.has(MAP_SET_CTORS, constructorName)) {
      return O.some(makeViolation(node, "new-map-set", "mapSetCtor", { ctor: constructorName }));
    }

    if (constructorName === "Date") {
      return O.some(makeViolation(node, "new-date", "newDate"));
    }

    if (HashSet.has(NATIVE_ERROR_CTORS, constructorName)) {
      return O.some(makeViolation(node, "native-error", "nativeError", { ctor: constructorName }));
    }

    return O.none();
  }

  return pipe(
    getMemberCall(expression),
    O.filter(
      ([objectName, propertyName]) => objectName === "globalThis" && HashSet.has(NATIVE_ERROR_CTORS, propertyName)
    ),
    O.map(([, ctor]) => makeViolation(node, "native-error", "nativeError", { ctor }))
  );
};

const detectCallExpressionViolation = (
  node: CallExpression,
  inHotspotScope: boolean
): O.Option<NativeRuntimeViolation> => {
  const expression = node.getExpression();

  if (Node.isIdentifier(expression)) {
    const calleeName = expression.getText();

    if (HashSet.has(NATIVE_ERROR_CTORS, calleeName)) {
      return O.some(makeViolation(node, "native-error", "nativeError", { ctor: calleeName }));
    }

    if (inHotspotScope && calleeName === "fetch") {
      return O.some(makeViolation(node, "native-fetch", "nativeFetch"));
    }

    return O.none();
  }

  return pipe(
    getMemberCall(expression),
    O.flatMap(([objectName, propertyName]) => {
      if (objectName === "globalThis" && HashSet.has(NATIVE_ERROR_CTORS, propertyName)) {
        return O.some(makeViolation(node, "native-error", "nativeError", { ctor: propertyName }));
      }

      if (inHotspotScope && objectName === "globalThis" && propertyName === "fetch") {
        return O.some(makeViolation(node, "native-fetch", "nativeFetch"));
      }

      if (objectName === "Object" && HashSet.has(OBJECT_METHODS, propertyName)) {
        return O.some(makeViolation(node, "object-method", "objectMethod", { method: propertyName }));
      }

      if (objectName === "Date" && HashSet.has(DATE_METHODS, propertyName)) {
        return O.some(makeViolation(node, "date-static", "dateStatic", { method: propertyName }));
      }

      if (objectName === "Array" && HashSet.has(ARRAY_STATIC_METHODS, propertyName)) {
        return O.some(makeViolation(node, "array-static", "arrayStatic", { method: propertyName }));
      }

      if (inHotspotScope && propertyName === "sort" && objectName !== "A") {
        return O.some(makeViolation(node, "native-sort", "nativeSort"));
      }

      if (inHotspotScope && HashSet.has(STRING_METHODS, propertyName) && objectName !== "Str") {
        return O.some(makeViolation(node, "string-method", "stringMethod", { method: propertyName }));
      }

      return O.none();
    })
  );
};

const detectBinaryExpressionViolation = (node: BinaryExpression): O.Option<NativeRuntimeViolation> => {
  const operator = node.getOperatorToken().getText();
  if (!HashSet.has(EQUALITY_OPERATORS, operator)) {
    return O.none();
  }

  const leftNode = node.getLeft();
  const rightNode = node.getRight();

  if (
    isIgnoredPlatformTypeofComparison(leftNode, rightNode) ||
    isIgnoredPlatformTypeofComparison(rightNode, leftNode)
  ) {
    return O.none();
  }

  return hasRuntimeTypeofComparison(leftNode, rightNode) || hasRuntimeTypeofComparison(rightNode, leftNode)
    ? O.some(makeViolation(node, "typeof-runtime", "typeofRuntime"))
    : O.none();
};

const detectSwitchStatementViolation = (node: SwitchStatement): O.Option<NativeRuntimeViolation> =>
  O.some(makeViolation(node, "native-switch", "nativeSwitch"));

const formatViolationMessage = (violation: NativeRuntimeViolation): string => {
  const data = violation.data;

  if (violation.messageId === "allowlistInvalid") {
    return `Effect laws allowlist is invalid: ${data?.detail ?? ""}`;
  }

  if (violation.messageId === "objectMethod") {
    return `Avoid Object.${data?.method ?? ""} in domain logic. Use Effect modules or add an allowlist entry.`;
  }

  if (violation.messageId === "mapSetCtor") {
    return `Avoid new ${data?.ctor ?? ""} in domain logic. Use Effect HashMap/HashSet variants or add an allowlist entry.`;
  }

  if (violation.messageId === "newDate") {
    return "Avoid new Date() in domain logic. Use Effect DateTime/Clock or add an allowlist entry.";
  }

  if (violation.messageId === "nativeError") {
    return `Avoid native ${data?.ctor ?? ""} in production code. Use TaggedErrorClass or add an allowlist entry.`;
  }

  if (violation.messageId === "dateStatic") {
    return `Avoid Date.${data?.method ?? ""} in domain logic. Use Effect DateTime/Clock or add an allowlist entry.`;
  }

  if (violation.messageId === "arrayStatic") {
    return `Avoid Array.${data?.method ?? ""} in domain logic. Use effect/Array helpers or add an allowlist entry.`;
  }

  if (violation.messageId === "typeofRuntime") {
    return "Avoid runtime typeof checks. Use effect/Predicate guards (for example P.isString).";
  }

  if (violation.messageId === "nodeRuntimeImport") {
    return `Avoid ${data?.moduleName ?? ""} runtime imports in hotspot runtime code. Use Effect FileSystem/Path/process services.`;
  }

  if (violation.messageId === "nativeFetch") {
    return "Avoid native fetch in hotspot runtime code. Use effect/unstable/http HttpClient and runtime client layers.";
  }

  if (violation.messageId === "nativeSort") {
    return "Avoid native .sort in hotspot runtime code. Use A.sort with an explicit Order.";
  }

  if (violation.messageId === "nativeSwitch") {
    return "Avoid native switch statements. Use effect/Match, Match.tagsExhaustive for _tag unions, or schema .match for tagged-union schemas.";
  }

  return `Avoid native string method .${data?.method ?? ""} in hotspot runtime code. Prefer effect/String and shared schema transforms.`;
};

const collectNativeRuntimeViolations = (
  sourceFile: SourceFile,
  inHotspotScope: boolean
): ReadonlyArray<NativeRuntimeViolation> => {
  let violations = A.empty<NativeRuntimeViolation>();

  sourceFile.forEachDescendant((node: import("ts-morph").Node) => {
    const violation = Match.value(node).pipe(
      Match.when(Node.isImportDeclaration, (declaration) => detectImportViolation(declaration, inHotspotScope)),
      Match.when(Node.isNewExpression, detectNewExpressionViolation),
      Match.when(Node.isCallExpression, (expression) => detectCallExpressionViolation(expression, inHotspotScope)),
      Match.when(Node.isBinaryExpression, detectBinaryExpressionViolation),
      Match.when(Node.isSwitchStatement, detectSwitchStatementViolation),
      Match.orElse(O.none<NativeRuntimeViolation>)
    );

    if (O.isSome(violation)) {
      violations = A.append(violations, violation.value);
    }
  });

  return violations;
};

/**
 * Collect normalized native-runtime violation keys for allowlist integrity checks.
 *
 * @example
 * ```ts
 * console.log("collectNativeRuntimeViolationKeys")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const collectNativeRuntimeViolationKeys: {
  (sourceFile: SourceFile, options: NativeRuntimeViolationKeyOptions): ReadonlyArray<string>;
  (options: NativeRuntimeViolationKeyOptions): (sourceFile: SourceFile) => ReadonlyArray<string>;
} = dual(
  2,
  (sourceFile: SourceFile, options: NativeRuntimeViolationKeyOptions): ReadonlyArray<string> =>
    pipe(
      collectNativeRuntimeViolations(sourceFile, options.inHotspotScope),
      A.map((violation) => makeAllowlistKey(options.relativeFilePath, violation.kind))
    )
);

/**
 * Run repo-local native runtime checks.
 *
 * Non-hotspot files remain warning-only for `--check` so the P3 cutover preserves the
 * old warn-vs-error split while moving the blocking path away from the repo-wide ESLint lane.
 *
 * @example
 * ```ts
 * console.log("runNoNativeRuntimeRules")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const runNoNativeRuntimeRules = Effect.fn("runNoNativeRuntimeRules")(function* (
  options: NoNativeRuntimeRulesOptions
) {
  const path = yield* Path.Path;
  const cwd = process.cwd();
  const allowlistDiagnostics = getAllowlistDiagnostics();
  const expectedAllowlistKeys = pipe(
    getAllowlistEntries(),
    A.filter((entry) => entry.rule === NO_NATIVE_RUNTIME_RULE_ID),
    A.map((entry) => makeAllowlistKey(entry.file, entry.kind))
  );
  let usedAllowlistKeys = HashSet.empty<string>();

  const isExcludedFile = (filePath: string): boolean => isExcludedLawScanPath(options.excludePaths, filePath);

  const project = new Project({
    tsConfigFilePath: path.join(cwd, "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  project.addSourceFilesAtPaths(options.includePaths ?? SOURCE_FILE_GLOBS);

  let sourceFiles = A.empty<ScannedSourceFile>();

  for (const sourceFile of project.getSourceFiles()) {
    const relativeFilePath = toPosixPath(path.relative(cwd, sourceFile.getFilePath()));

    if (isExcludedFile(relativeFilePath)) {
      continue;
    }

    sourceFiles = A.append(sourceFiles, [relativeFilePath, sourceFile]);
  }

  sourceFiles = A.sort(sourceFiles, byScannedSourceFilePathAscending);

  let warningCount = 0;
  let errorCount = 0;
  let affectedFiles = A.empty<string>();
  let diagnostics = A.empty<(typeof NoNativeRuntimeDiagnostic)["Type"]>();

  for (const detail of allowlistDiagnostics) {
    errorCount += 1;
    diagnostics = A.append(
      diagnostics,
      NoNativeRuntimeDiagnostic.make({
        severity: "error",
        file: ALLOWLIST_PATH,
        line: 1,
        column: 1,
        message: `Effect laws allowlist is invalid: ${detail}`,
        messageId: "allowlistInvalid",
      })
    );
  }

  if (A.length(allowlistDiagnostics) > 0) {
    affectedFiles = A.append(affectedFiles, ALLOWLIST_PATH);
  }

  const appendViolation = (
    sourceFile: SourceFile,
    relativeFilePath: string,
    baseSeverity: "warn" | "error",
    violation: NativeRuntimeViolation
  ): void => {
    const isAllowlisted = isViolationAllowlisted({
      ruleId: NO_NATIVE_RUNTIME_RULE_ID,
      filePath: relativeFilePath,
      kind: violation.kind,
    });

    if (isAllowlisted) {
      usedAllowlistKeys = HashSet.add(usedAllowlistKeys, makeAllowlistKey(relativeFilePath, violation.kind));
      return;
    }

    const { line, column } = sourceFile.getLineAndColumnAtPos(violation.node.getStart());
    const severity = violation.kind === "native-switch" ? "error" : baseSeverity;

    if (severity === "error") {
      errorCount += 1;
    } else {
      warningCount += 1;
    }

    diagnostics = A.append(
      diagnostics,
      NoNativeRuntimeDiagnostic.make({
        severity,
        file: relativeFilePath,
        line,
        column,
        message: formatViolationMessage(violation),
        messageId: violation.messageId,
      })
    );
  };

  for (const [relativeFilePath, sourceFile] of sourceFiles) {
    const inHotspotScope = isNoNativeRuntimeExtraCheckHotspot(relativeFilePath);
    const baseSeverity = isNoNativeRuntimeErrorFile(relativeFilePath) ? "error" : "warn";
    const diagnosticsBeforeFile = A.length(diagnostics);

    const scanSourceFile = Effect.try({
      try: () => {
        for (const violation of collectNativeRuntimeViolations(sourceFile, inHotspotScope)) {
          appendViolation(sourceFile, relativeFilePath, baseSeverity, violation);
        }
      },
      catch: (cause) =>
        NoNativeRuntimeRulesExecutionError.new(
          `Failed to evaluate ${relativeFilePath}: ${Inspectable.toStringUnknown(cause, 0)}`
        ),
    });

    yield* scanSourceFile;

    if (A.length(diagnostics) > diagnosticsBeforeFile) {
      affectedFiles = A.append(affectedFiles, relativeFilePath);
    }
  }

  return NoNativeRuntimeRulesSummary.make({
    scannedFiles: sourceFiles.length,
    touchedFiles: affectedFiles.length,
    warningCount,
    errorCount,
    strictFailure: options.strictCheck && (warningCount > 0 || errorCount > 0),
    affectedFiles,
    allowlistedCount: HashSet.size(usedAllowlistKeys),
    unusedAllowlistEntries: A.filter(expectedAllowlistKeys, (key) => !HashSet.has(usedAllowlistKeys, key)),
    diagnostics,
  });
});
