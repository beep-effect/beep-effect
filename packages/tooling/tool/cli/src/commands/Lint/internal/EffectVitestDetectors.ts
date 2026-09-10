/** Syntax-only EV001-EV015 detectors. @packageDocumentation @since 0.0.0 */

import { createHash } from "node:crypto";
import { A, Str } from "@beep/utils";
import { HashMap, MutableHashMap } from "effect";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import { Node, SyntaxKind } from "ts-morph";
import { EffectVitestFinding, EffectVitestReplacement } from "../Lint.schemas.ts";
import { EffectVitestRulePolicies } from "./EffectVitestPolicy.ts";
import {
  callbackCalls,
  callLabel,
  classifyHarnessCall,
  collectEffectVitestImports,
  compactEvidence,
  createEffectVitestHarnessIndex,
  effectVitestTestCallbacks,
  enclosingTest,
  isHarnessMethodCall,
  isProvenanceCall,
  isProvenanceExpression,
  isWholeBodyCall,
  rootTestBodyCall,
  sourceFunctionDefinitions,
} from "./EffectVitestSyntax.ts";
import type {
  CallExpression,
  Expression,
  Identifier,
  ImportDeclaration,
  Node as MorphNode,
  SourceFile,
  VariableDeclaration,
} from "ts-morph";
import type { EffectVitestRuleId, EffectVitestSeverity } from "../Lint.schemas.ts";
import type { EffectVitestFunctionNode, EffectVitestHarnessIndex, EffectVitestImports } from "./EffectVitestSyntax.ts";

const EFFECT_MODULES = ["effect", "effect/Effect"];
const LAYER_MODULES = ["effect", "effect/Layer"];
const OPTION_MODULES = ["effect", "effect/Option", "@beep/utils/Option"];
const RESULT_MODULES = ["effect", "effect/Result"];
const EXIT_MODULES = ["effect", "effect/Exit"];
const CONTEXT_MODULES = ["effect", "effect/Context"];
const SCHEDULE_MODULES = ["effect", "effect/Schedule"];
const TEST_CLOCK_MODULES = ["effect/testing", "effect/testing/TestClock"];
const ARBITRARY_MODULES = ["effect/unstable/arbitrary", "effect/unstable/arbitrary/Arbitrary"];
const FAST_CHECK_MODULES = ["effect/testing", "effect/testing/FastCheck", "fast-check"];
const VITEST_MODULES = ["@effect/vitest", "vitest"];

// A fixed dispatch index avoids scanning the full member list for every call.
const detectorCallMembers = HashSet.fromIterable([
  "runPromise",
  "runSync",
  "runFork",
  "provide",
  "provideScopedLayer",
  "scoped",
  "result",
  "expect",
  "assert",
  "checkEffect",
  "assertTrue",
  "assertFalse",
  "isTrue",
  "isFalse",
  "ok",
  "equal",
  "strictEqual",
  "sleep",
  "spaced",
  "fixed",
  "exponential",
  "live",
  "mock",
  "spyOn",
  "layer",
  "adjust",
  "skip",
  "only",
  "each",
  "fails",
  "skipIf",
  "runIf",
  "prop",
  "default",
]);

type FindingInput = {
  readonly ruleId: EffectVitestRuleId;
  readonly node: MorphNode;
  readonly file: string;
  readonly owner: string;
  readonly symbol: string;
  readonly judgment?: boolean;
  readonly className?: string;
  readonly replacement?: EffectVitestReplacement;
};

const initialFinding = (input: FindingInput): EffectVitestFinding => {
  const defaultSeverity: EffectVitestSeverity = "info";
  const policy = O.getOrElse(HashMap.get(EffectVitestRulePolicies, input.ruleId), () => ({
    className: input.ruleId,
    primitive: "it.effect",
    sketch: "Review this Effect Vitest finding.",
    severity: defaultSeverity,
  }));
  const line = input.node.getStartLineNumber();
  return EffectVitestFinding.make({
    id: `${input.ruleId}:${input.file}:${line}:${input.symbol}@${input.node.getStart() - input.node.getStartLinePos()}#1`,
    lens: input.judgment === true ? "resource" : "detector",
    ruleId: input.ruleId,
    package: input.owner,
    file: input.file,
    line,
    endLine: O.some(input.node.getEndLineNumber()),
    symbol: O.some(input.symbol),
    testName: O.none(),
    class: input.className ?? policy.className,
    evidence: compactEvidence(input.node),
    replacement:
      input.replacement ?? EffectVitestReplacement.make({ primitive: policy.primitive, sketch: policy.sketch }),
    severity: policy.severity,
    confidence: input.judgment === true ? 0.55 : 0.95,
    mechanization: input.judgment === true ? "judgment" : "detector",
    status: "open",
    reason: O.none(),
    fixSha: O.none(),
  });
};

const isNativePropertyCheck = (call: CallExpression, imports: EffectVitestImports): boolean =>
  isProvenanceCall(call, imports, ARBITRARY_MODULES, "Arbitrary", ["checkEffect"]);

const callMember = (call: CallExpression): string => {
  let expression = call.getExpression();
  while (Node.isCallExpression(expression)) expression = expression.getExpression();
  if (Node.isPropertyAccessExpression(expression)) return expression.getName();
  return Node.isIdentifier(expression) ? expression.getText() : "";
};

const scopeContains = (scope: MorphNode, node: MorphNode): boolean =>
  scope === node || A.some(node.getAncestors(), (ancestor) => ancestor === scope);

const localInitializer = (identifier: Identifier, imports: EffectVitestImports): O.Option<Expression> =>
  O.flatMap(imports.resolveBinding(identifier), (declaration) =>
    Node.isVariableDeclaration(declaration) && declaration.getName() === identifier.getText()
      ? O.fromUndefinedOr(declaration.getInitializer())
      : O.none()
  );

const isPureStubLayer = (
  expression: Expression,
  imports: EffectVitestImports,
  seen: ReadonlyArray<string> = []
): boolean => {
  if (Node.isCallExpression(expression)) {
    if (isProvenanceCall(expression, imports, LAYER_MODULES, "Layer", ["succeed", "mock"])) return true;
    if (isProvenanceCall(expression, imports, LAYER_MODULES, "Layer", ["merge", "mergeAll"])) {
      return A.every(
        expression.getArguments(),
        (argument) => Node.isExpression(argument) && isPureStubLayer(argument, imports, seen)
      );
    }
    return false;
  }
  if (!Node.isIdentifier(expression) || A.contains(seen, expression.getText())) return false;
  return O.exists(localInitializer(expression, imports), (initializer) =>
    isPureStubLayer(initializer, imports, [...seen, expression.getText()])
  );
};

const isContextProvision = (
  expression: Expression,
  imports: EffectVitestImports,
  seen: ReadonlyArray<string> = []
): boolean => {
  if (Node.isCallExpression(expression)) {
    return isProvenanceCall(expression, imports, CONTEXT_MODULES, "Context", ["make", "empty", "add", "merge"]);
  }
  if (!Node.isIdentifier(expression) || A.contains(seen, expression.getText())) return false;
  return O.exists(localInitializer(expression, imports), (initializer) =>
    isContextProvision(initializer, imports, [...seen, expression.getText()])
  );
};

const isResourceExpression = (
  expression: Expression,
  imports: EffectVitestImports,
  seen: ReadonlyArray<string> = []
): boolean => {
  if (Node.isCallExpression(expression)) {
    if (isProvenanceCall(expression, imports, LAYER_MODULES, "Layer", ["scoped", "effect", "unwrap", "launch"]))
      return true;
    if (isProvenanceCall(expression, imports, EFFECT_MODULES, "Effect", ["acquireRelease", "acquireUseRelease"]))
      return true;
    return A.some(
      expression.getArguments(),
      (argument) => Node.isExpression(argument) && isResourceExpression(argument, imports, seen)
    );
  }
  if (!Node.isIdentifier(expression) || A.contains(seen, expression.getText())) return false;
  return O.exists(localInitializer(expression, imports), (initializer) =>
    isResourceExpression(initializer, imports, [...seen, expression.getText()])
  );
};

const functionHasResource = (definition: EffectVitestFunctionNode, imports: EffectVitestImports): boolean =>
  A.some(
    callbackCalls(definition),
    (call) =>
      isProvenanceCall(call, imports, LAYER_MODULES, "Layer", ["scoped", "effect", "unwrap", "launch"]) ||
      isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["acquireRelease", "acquireUseRelease"])
  );

const buildsAndProvidesLayer = (definition: EffectVitestFunctionNode, imports: EffectVitestImports): boolean => {
  const calls = callbackCalls(definition);
  return (
    A.some(
      calls,
      (call) =>
        isProvenanceCall(call, imports, LAYER_MODULES, "Layer", ["build"]) &&
        O.exists(providedLayer(call), (layer) => !isPureStubLayer(layer, imports))
    ) && A.some(calls, (call) => isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["provide"]))
  );
};

const wrapperName = (name: string): boolean => Str.startsWith("with")(name) && O.isSome(Str.match(/^with[A-Z]/u)(name));
const providedLayer = (call: CallExpression): O.Option<Expression> =>
  O.flatMap(A.last(call.getArguments()), (argument) => (Node.isExpression(argument) ? O.some(argument) : O.none()));
const isExpectCall = (call: CallExpression, imports: EffectVitestImports): boolean =>
  isProvenanceCall(call, imports, VITEST_MODULES, "expect", ["expect"]);
const isBooleanAssertion = (call: CallExpression, imports: EffectVitestImports): boolean =>
  isProvenanceCall(call, imports, ["@effect/vitest/utils"], "utils", ["assertTrue", "assertFalse"]) ||
  isProvenanceCall(call, imports, VITEST_MODULES, "assert", ["isTrue", "isFalse", "ok", "assert"]) ||
  isProvenanceCall(call, imports, ["node:assert", "node:assert/strict", "assert", "assert/strict"], "assert", [
    "ok",
    "equal",
    "strictEqual",
    "assert",
  ]);
const isAssertion = (call: CallExpression, imports: EffectVitestImports): boolean =>
  isExpectCall(call, imports) || isBooleanAssertion(call, imports);
const nearestTestCallback = (node: MorphNode, imports: EffectVitestImports): O.Option<EffectVitestFunctionNode> =>
  O.map(enclosingTest(node, imports), ({ callback }) => callback);

const assertedOutcome = (call: CallExpression, imports: EffectVitestImports): boolean => {
  let current = call.getParent();
  while (current !== undefined && !Node.isStatement(current)) {
    if (Node.isCallExpression(current) && isAssertion(current, imports)) return true;
    current = current.getParent();
  }
  const declaration = call.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (declaration === undefined) return false;
  const initializer = declaration.getInitializer();
  if (initializer !== call && !(Node.isYieldExpression(initializer) && initializer.getExpression() === call))
    return false;
  return O.exists(nearestTestCallback(call, imports), (callback) =>
    A.some(
      callbackCalls(callback),
      (candidate) =>
        isAssertion(candidate, imports) &&
        A.some(candidate.getArguments(), (argument) =>
          A.some(
            Node.isIdentifier(argument) ? [argument] : argument.getDescendantsOfKind(SyntaxKind.Identifier),
            (reference) => O.exists(imports.resolveBinding(reference), (binding) => binding === declaration)
          )
        )
    )
  );
};

const dataShapeCall = (call: CallExpression, imports: EffectVitestImports): boolean =>
  isProvenanceCall(call, imports, OPTION_MODULES, "Option", ["isSome", "isNone", "some", "none"]) ||
  isProvenanceCall(call, imports, RESULT_MODULES, "Result", ["isSuccess", "isFailure", "succeed", "fail"]) ||
  isProvenanceCall(call, imports, EXIT_MODULES, "Exit", ["isSuccess", "isFailure", "succeed", "fail"]);
const dataShapeReference = (node: MorphNode, imports: EffectVitestImports): boolean =>
  Node.isExpression(node) &&
  (isProvenanceExpression(node, imports, OPTION_MODULES, "Option", ["isSome", "isNone"]) ||
    isProvenanceExpression(node, imports, RESULT_MODULES, "Result", ["isSuccess", "isFailure"]) ||
    isProvenanceExpression(node, imports, EXIT_MODULES, "Exit", ["isSuccess", "isFailure"]));
// Only these rc.113 public operations have a fixed tagged/Boolean result after full application.
const taggedValueOperations = [
  { modules: OPTION_MODULES, namespace: "Option", members: ["all", "flatten"], arity: 1 },
  { modules: OPTION_MODULES, namespace: "Option", members: ["map", "flatMap", "filter", "contains"], arity: 2 },
  { modules: RESULT_MODULES, namespace: "Result", members: ["all", "flip"], arity: 1 },
  { modules: RESULT_MODULES, namespace: "Result", members: ["map", "mapError", "flatMap"], arity: 2 },
  { modules: EXIT_MODULES, namespace: "Exit", members: ["map", "mapError", "mapBoth"], arity: 2 },
];

const taggedValueApplication = (expression: MorphNode, supplied: number, imports: EffectVitestImports): boolean => {
  if (Node.isCallExpression(expression)) {
    const args = expression.getArguments();
    return (
      args.length > 0 &&
      !A.some(args, Node.isSpreadElement) &&
      taggedValueApplication(expression.getExpression(), supplied + args.length, imports)
    );
  }
  return (
    Node.isExpression(expression) &&
    A.some(
      taggedValueOperations,
      ({ modules, namespace, members, arity }) =>
        supplied === arity && isProvenanceExpression(expression, imports, modules, namespace, members)
    )
  );
};

const terminalPipeStage = (call: CallExpression, imports: EffectVitestImports): O.Option<MorphNode> => {
  const expression = call.getExpression();
  const method = Node.isPropertyAccessExpression(expression) && expression.getName() === "pipe";
  const functional = isProvenanceCall(call, imports, ["effect", "effect/Function"], "Function", ["pipe"]);
  return method || (functional && call.getArguments().length > 1) ? A.last(call.getArguments()) : O.none();
};

const arrayPredicateCall = (call: CallExpression, imports: EffectVitestImports): boolean => {
  const expression = call.getExpression();
  const facade =
    Node.isPropertyAccessExpression(expression) &&
    A.contains(["every", "some"], expression.getName()) &&
    isProvenanceExpression(expression.getExpression(), imports, ["@beep/utils"], "utils", ["A"]);
  return (
    facade ||
    isProvenanceCall(call, imports, ["effect", "effect/Array", "@beep/utils/Array"], "Array", ["every", "some"])
  );
};

const returnedPredicateDataShape = (predicate: MorphNode, imports: EffectVitestImports): boolean => {
  if (!Node.isArrowFunction(predicate) && !Node.isFunctionExpression(predicate))
    return dataShapeReference(predicate, imports);
  if (predicate.isAsync()) return false;
  if (Node.isFunctionExpression(predicate) && predicate.getAsteriskToken() !== undefined) return false;
  const body = predicate.getBody();
  if (!Node.isBlock(body)) return containsDataShape(body, imports);
  const statements = body.getStatements();
  const statement = statements[0];
  return (
    statements.length === 1 &&
    Node.isReturnStatement(statement) &&
    O.exists(O.fromUndefinedOr(statement.getExpression()), (value) => containsDataShape(value, imports))
  );
};

const arrayPredicateDataShape = (call: CallExpression, imports: EffectVitestImports, applied = false): boolean => {
  const expression = call.getExpression();
  if (!applied && Node.isCallExpression(expression) && call.getArguments().length === 1)
    return arrayPredicateDataShape(expression, imports, true);
  if (!arrayPredicateCall(call, imports) || call.getArguments().length !== (applied ? 1 : 2)) return false;
  return O.exists(A.last(call.getArguments()), (predicate) => returnedPredicateDataShape(predicate, imports));
};

const yieldedTaggedDataShape = (node: MorphNode | undefined, imports: EffectVitestImports): boolean => {
  if (!Node.isCallExpression(node)) return false;
  if (isProvenanceCall(node, imports, EFFECT_MODULES, "Effect", ["exit", "result"]))
    return node.getArguments().length === 1;
  return O.exists(
    terminalPipeStage(node, imports),
    (stage) =>
      Node.isExpression(stage) && isProvenanceExpression(stage, imports, EFFECT_MODULES, "Effect", ["exit", "result"])
  );
};

const assertedCallDataShape = (call: CallExpression, imports: EffectVitestImports): boolean =>
  dataShapeCall(call, imports) ||
  (!A.some(call.getArguments(), Node.isSpreadElement) &&
    taggedValueApplication(call.getExpression(), call.getArguments().length, imports)) ||
  arrayPredicateDataShape(call, imports) ||
  O.exists(
    terminalPipeStage(call, imports),
    (stage) =>
      dataShapeReference(stage, imports) ||
      taggedValueApplication(stage, 1, imports) ||
      (Node.isCallExpression(stage) && arrayPredicateDataShape(stage, imports, true))
  );

const containsDataShape = (node: MorphNode, imports: EffectVitestImports): boolean => {
  if (Node.isYieldExpression(node))
    return node.getAsteriskToken() !== undefined && yieldedTaggedDataShape(node.getExpression(), imports);
  if (Node.isCallExpression(node)) return assertedCallDataShape(node, imports);
  if (
    A.contains(
      [
        SyntaxKind.PropertyAccessExpression,
        SyntaxKind.ElementAccessExpression,
        SyntaxKind.ArrowFunction,
        SyntaxKind.FunctionExpression,
        SyntaxKind.MethodDeclaration,
        SyntaxKind.GetAccessor,
        SyntaxKind.SetAccessor,
      ],
      node.getKind()
    )
  )
    return dataShapeReference(node, imports);
  return (
    dataShapeReference(node, imports) ||
    node.forEachChild((child) => (containsDataShape(child, imports) ? true : undefined)) === true
  );
};
const pipedWaitUses = (
  ancestor: CallExpression,
  wait: CallExpression,
  imports: EffectVitestImports,
  modules: ReadonlyArray<string>,
  namespace: string,
  members: ReadonlyArray<string>
): boolean => {
  const expression = ancestor.getExpression();
  return (
    Node.isPropertyAccessExpression(expression) &&
    expression.getName() === "pipe" &&
    scopeContains(expression.getExpression(), wait) &&
    A.some(
      ancestor.getArguments(),
      (argument) =>
        Node.isExpression(argument) && isProvenanceExpression(argument, imports, modules, namespace, members)
    )
  );
};

const liveClockFor = (wait: CallExpression, imports: EffectVitestImports): boolean =>
  A.some([wait, ...wait.getAncestors()], (ancestor) => {
    if (!Node.isCallExpression(ancestor)) return false;
    if (isProvenanceCall(ancestor, imports, TEST_CLOCK_MODULES, "TestClock", ["withLive"]))
      return A.some(ancestor.getArguments(), (argument) => scopeContains(argument, wait));
    return pipedWaitUses(ancestor, wait, imports, TEST_CLOCK_MODULES, "TestClock", ["withLive"]);
  });

const controlledWait = (
  wait: CallExpression,
  callback: EffectVitestFunctionNode,
  imports: EffectVitestImports
): boolean => {
  // A sibling clock operation cannot drive a directly awaited sleep. Only a
  // syntactically forked child can be controlled by the remainder of this body.
  const forked = A.some(wait.getAncestors(), (ancestor) => {
    if (!Node.isCallExpression(ancestor) || !scopeContains(callback, ancestor)) return false;
    const forks = ["forkChild", "forkScoped", "forkDetach"];
    if (isProvenanceCall(ancestor, imports, EFFECT_MODULES, "Effect", forks)) return true;
    return pipedWaitUses(ancestor, wait, imports, EFFECT_MODULES, "Effect", forks);
  });
  return (
    forked &&
    A.some(
      callbackCalls(callback),
      (call) =>
        isProvenanceCall(call, imports, TEST_CLOCK_MODULES, "TestClock", ["adjust", "setTime"]) ||
        isProvenanceCall(call, imports, ["effect", "effect/Fiber"], "Fiber", ["interrupt", "interruptAll"])
    )
  );
};
const liveServiceCall = (callback: EffectVitestFunctionNode, imports: EffectVitestImports): boolean =>
  A.some(
    callbackCalls(callback),
    (call) =>
      isProvenanceCall(call, imports, ["effect", "effect/Clock"], "Clock", [
        "currentTimeMillis",
        "currentTimeNanos",
        "sleep",
      ]) ||
      isProvenanceCall(call, imports, ["effect", "effect/Console"], "Console", ["log", "error", "warn", "info"]) ||
      isProvenanceCall(call, imports, TEST_CLOCK_MODULES, "TestClock", ["withLive"])
  );
const platformRoots = ["@effect/platform-bun", "@effect/platform-node", "@effect/platform-node-shared"];
const platformServicesModules = ["@effect/platform-node/NodeServices", "@effect/platform-bun/BunServices"];
const platformMemberModules = [...platformRoots, ...platformServicesModules];
const platformFileSystemImport = (moduleName: string): boolean =>
  A.contains(["node:fs", "node:fs/promises", "fs", "fs/promises"], moduleName) ||
  A.contains(
    [
      "@effect/platform-bun/BunFileSystem",
      "@effect/platform-node/NodeFileSystem",
      "@effect/platform-node-shared/NodeFileSystem",
    ],
    moduleName
  );

const platformReferenceMember = (reference: MorphNode): O.Option<string> => {
  const parent = reference.getParent();
  if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === reference) return O.some(parent.getName());
  if (Node.isElementAccessExpression(parent) && parent.getExpression() === reference)
    return O.fromUndefinedOr(parent.getArgumentExpression()).pipe(
      O.filter(Node.isStringLiteral),
      O.map((argument) => argument.getLiteralValue())
    );
  return Node.isCallExpression(parent) && A.contains(parent.getArguments(), reference) ? O.some("opaque") : O.none();
};

const platformNamespaceMembers = (
  binding: ImportDeclaration | VariableDeclaration,
  imports: EffectVitestImports
): ReadonlyArray<string> => {
  const name = Node.isImportDeclaration(binding)
    ? (binding.getNamespaceImport() ?? binding.getDefaultImport())
    : binding.getNameNode();
  if (!Node.isIdentifier(name)) return [];
  const local = name.getText();
  const references = A.filter(
    binding.getSourceFile().getDescendantsOfKind(SyntaxKind.Identifier),
    (reference) =>
      reference.getText() === local && O.exists(imports.resolveBinding(reference), (resolved) => resolved === binding)
  );
  return A.getSomes(A.map(references, platformReferenceMember));
};

const platformImportedMembers = (
  declaration: ImportDeclaration,
  imports: EffectVitestImports
): ReadonlyArray<string> => {
  const named = A.map(
    A.filter(declaration.getNamedImports(), (binding) => !binding.isTypeOnly()),
    (binding) => binding.getName()
  );
  return [...named, ...platformNamespaceMembers(declaration, imports)];
};

const platformRequiredMembers = (call: CallExpression, imports: EffectVitestImports): ReadonlyArray<string> => {
  const parent = call.getParent();
  if (!Node.isVariableDeclaration(parent)) return A.fromOption(platformReferenceMember(call));
  const name = parent.getNameNode();
  if (Node.isObjectBindingPattern(name))
    return A.map(name.getElements(), (element) => (element.getPropertyNameNode() ?? element.getNameNode()).getText());
  return platformNamespaceMembers(parent, imports);
};

const platformResourceReview = (moduleName: string, members: ReadonlyArray<string>): boolean =>
  A.some(members, (member) => A.contains(["NodeServices", "BunServices", "Services", "opaque"], member)) ||
  (A.contains(platformServicesModules, moduleName) && A.contains(members, "layer"));

const serviceMockTarget = (call: CallExpression, imports: EffectVitestImports): O.Option<string> => {
  const target = call.getArguments()[0];
  if (Node.isStringLiteral(target)) {
    const value = target.getLiteralValue();
    return value === "effect" || Str.startsWith("effect/")(value) || Str.startsWith("@beep/")(value)
      ? O.some("unproven-module-mock-review")
      : O.none();
  }
  if (!Node.isIdentifier(target)) return O.none();
  return imports.resolveBinding(target).pipe(
    O.filter(Node.isClassDeclaration),
    O.flatMap((declaration) => O.fromUndefinedOr(declaration.getExtends())),
    O.filter((heritage) =>
      isProvenanceExpression(heritage.getExpression(), imports, CONTEXT_MODULES, "Context", ["Service"])
    ),
    O.map(() => "effect-service-mock-candidate")
  );
};

const loopIsRetryCandidate = (node: MorphNode, imports: EffectVitestImports): boolean => {
  const identifiers = A.map(node.getDescendantsOfKind(SyntaxKind.Identifier), (identifier) => identifier.getText());
  const retryState = A.some(identifiers, (name) => O.isSome(Str.match(/^(?:attempt|attempts|retry|retries)$/iu)(name)));
  const waits = A.some(node.getDescendantsOfKind(SyntaxKind.CallExpression), (call) =>
    isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["sleep"])
  );
  return retryState || waits;
};
const layerHasTimeout = (call: CallExpression): boolean => {
  const options = call.getArguments()[1];
  return Node.isObjectLiteralExpression(options) && options.getProperty("timeout") !== undefined;
};

const effectRegistrationBody = (call: CallExpression, effectTest: boolean, imports: EffectVitestImports): boolean =>
  effectTest ||
  rootTestBodyCall(call, imports) ||
  A.some(
    call.getAncestors(),
    (ancestor) =>
      Node.isCallExpression(ancestor) &&
      O.exists(classifyHarnessCall(ancestor, imports), (mode) => mode === "effect" || mode === "live")
  );

const appendTokenChildren = (pending: Array<MorphNode>, children: ReadonlyArray<MorphNode>): void => {
  for (let index = children.length - 1; index >= 0; index--) {
    const child = children[index];
    if (child !== undefined) pending.push(child);
  }
};

const occurrenceAnchor = (
  node: MorphNode,
  imports: EffectVitestImports,
  statements: MutableHashMap.MutableHashMap<number, string>
): string => {
  const contexts = A.filter(
    node.getAncestors(),
    (ancestor) =>
      Node.isCallExpression(ancestor) &&
      (O.isSome(classifyHarnessCall(ancestor, imports)) ||
        isProvenanceCall(ancestor, imports, VITEST_MODULES, "describe", ["describe"]))
  );
  const labels = A.map(contexts, (context) =>
    Node.isCallExpression(context)
      ? A.map(A.filter(context.getArguments(), Node.isStringLiteral), (name) => name.getText())
      : []
  );
  const statement = node.getFirstAncestor((ancestor) => Node.isStatement(ancestor)) ?? node;
  const hash = createHash("sha256");
  // Length delimiters keep token and title boundaries unambiguous; literal text
  // is retained verbatim instead of collapsing significant string whitespace.
  for (const label of A.flatten(labels)) hash.update(`${label.length}:${label}`);
  const tokens = O.getOrElse(MutableHashMap.get(statements, statement.getStart()), () => {
    const digest = createHash("sha256");
    // Stream the same getChildren leaves in preorder, including ts-morph's
    // synthetic comments and empty syntax lists, without materializing every
    // descendant or resuming a generator at each ancestor level.
    const pending = A.reverse(statement.getChildren());
    const tokenParts = A.empty<string>();
    while (pending.length > 0) {
      const token = pending.pop();
      if (token === undefined) continue;
      const children = token.getChildren();
      if (children.length === 0) {
        const text = token.getText();
        tokenParts.push(`${token.getKind()}:${text.length}:${text}`);
      } else {
        appendTokenChildren(pending, children);
      }
    }
    const value = digest.update(A.join(tokenParts, "")).digest("hex");
    MutableHashMap.set(statements, statement.getStart(), value);
    return value;
  });
  return `v2:${hash.update(tokens).digest("hex")}`;
};

const assignStableIds = (findings: ReadonlyArray<EffectVitestFinding>): ReadonlyArray<EffectVitestFinding> => {
  const counts = MutableHashMap.empty<string, number>();
  return A.map(findings, (finding) => {
    const key = `${finding.ruleId}:${O.getOrNull(finding.symbol)}:${finding.class}:${finding.evidence}:${O.getOrNull(finding.occurrence)}`;
    const ordinal = 1 + O.getOrElse(MutableHashMap.get(counts, key), () => 0);
    MutableHashMap.set(counts, key, ordinal);
    return EffectVitestFinding.make({ ...finding, id: Str.replace(/#\d+$/u, `#${ordinal}`)(finding.id) });
  });
};

type DetectorState = {
  readonly imports: EffectVitestImports;
  readonly harness: EffectVitestHarnessIndex;
  readonly makeFinding: (input: FindingInput) => EffectVitestFinding;
  readonly findings: Array<EffectVitestFinding>;
  readonly definitions: ReturnType<typeof sourceFunctionDefinitions>;
  readonly helperNames: ReadonlyArray<string>;
  readonly calls: ReadonlyArray<CallExpression>;
  readonly file: string;
  readonly owner: string;
};

const inspectContext = (call: CallExpression, member: string, canonicalMember: string, state: DetectorState) => {
  const { imports, harness, definitions } = state;

  const test = harness.enclosingTest(call);
  const inTest = O.isSome(test);
  const effectTest = O.exists(test, ({ mode }) => mode === "effect" || mode === "live");
  const testClockMode = O.exists(test, ({ mode }) => mode === "effect");
  const helper =
    !inTest &&
    (isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["runPromise", "runSync", "runFork", "scoped"]) ||
      isProvenanceCall(call, imports, FAST_CHECK_MODULES, "FastCheck", ["assert"]) ||
      isNativePropertyCheck(call, imports))
      ? harness.reachableHelper(call)
      : O.none();
  const publicProvider = isProvenanceCall(
    call,
    imports,
    ["@beep/test-utils", "@beep/test-utils/Layer"],
    "provideScopedLayer",
    ["provideScopedLayer"]
  );
  const expression = call.getExpression();
  const definition = Node.isIdentifier(expression)
    ? O.flatMap(imports.resolveBinding(expression), (binding) =>
        A.findFirst(definitions, ({ node }) => scopeContains(binding, node))
      )
    : O.none();
  const localProvider = O.exists(definition, ({ node }) => buildsAndProvidesLayer(node, imports));
  return {
    call,
    member,
    canonicalMember,
    test,
    inTest,
    effectTest,
    testClockMode,
    helper,
    publicProvider,
    expression,
    definition,
    localProvider,
  };
};

const detectRuntimeBoundary = (
  { call, canonicalMember, inTest, helper }: ReturnType<typeof inspectContext>,
  state: DetectorState
): void => {
  const { imports, makeFinding, findings, file, owner } = state;

  if (
    (inTest || O.isSome(helper)) &&
    A.contains(["runPromise", "runSync", "runFork"], canonicalMember) &&
    isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", [canonicalMember])
  ) {
    const shared = O.exists(helper, ({ shared }) => shared);
    findings.push(
      makeFinding({
        ruleId: "EV001",
        node: call,
        file,
        owner,
        symbol: callMember(call),
        judgment: shared,
        ...(shared ? { className: "shared-helper-runtime-boundary-review" } : {}),
      })
    );
  }
};

const detectLayerProvision = (
  { call, member, effectTest, publicProvider, localProvider }: ReturnType<typeof inspectContext>,
  state: DetectorState
): void => {
  const { imports, makeFinding, findings, file, owner } = state;

  if (
    !Node.isCallExpression(call.getExpression()) &&
    (publicProvider || localProvider || isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["provide"])) &&
    effectRegistrationBody(call, effectTest, imports)
  ) {
    const layer = providedLayer(call);
    if (O.exists(layer, (value) => !isPureStubLayer(value, imports) && !isContextProvision(value, imports))) {
      const unresolved = !O.exists(layer, (value) => isResourceExpression(value, imports));
      findings.push(
        makeFinding({
          ruleId: "EV002",
          node: call,
          file,
          owner,
          symbol: member,
          judgment: unresolved,
          ...(unresolved ? { className: "unresolved-layer-provide" } : {}),
        })
      );
    }
  }
};

const isUnresolvedImportedWrapper = (
  { expression, definition }: ReturnType<typeof inspectContext>,
  imports: EffectVitestImports
): boolean =>
  O.isNone(definition) &&
  Node.isIdentifier(expression) &&
  O.exists(imports.resolveBinding(expression), Node.isImportDeclaration);

const detectResourceWrapper = (context: ReturnType<typeof inspectContext>, state: DetectorState): void => {
  const { call, member, canonicalMember, test, definition } = context;
  const { imports, makeFinding, findings, file, owner } = state;

  if (
    (wrapperName(member) ||
      wrapperName(canonicalMember) ||
      O.exists(definition, ({ node }) => functionHasResource(node, imports))) &&
    (rootTestBodyCall(call, imports) || O.exists(test, ({ callback }) => isWholeBodyCall(call, callback)))
  ) {
    if (O.exists(definition, ({ node }) => functionHasResource(node, imports))) {
      findings.push(makeFinding({ ruleId: "EV003", node: call, file, owner, symbol: member }));
    } else if (isUnresolvedImportedWrapper(context, imports)) {
      findings.push(
        makeFinding({
          ruleId: "EV003",
          node: call,
          file,
          owner,
          symbol: member,
          judgment: true,
          className: "unresolved-resource-wrapper",
        })
      );
    }
  }
};

const detectScopeLifetime = (
  { call, canonicalMember, test, effectTest, helper }: ReturnType<typeof inspectContext>,
  state: DetectorState
): void => {
  const { imports, makeFinding, findings, file, owner } = state;

  if (
    (effectTest || O.exists(helper, ({ effect }) => effect)) &&
    canonicalMember === "scoped" &&
    isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["scoped"])
  ) {
    const wholeBody = O.exists(test, ({ callback }) => isWholeBodyCall(call, callback));
    const scopeClass = O.match(helper, {
      onNone: () => "shorter-scope-lifetime-review",
      onSome: ({ callback, shared, plain }) =>
        shared || plain
          ? "shared-helper-scope-lifetime-review"
          : isWholeBodyCall(call, callback)
            ? "helper-scope-lifetime-review"
            : "inner-helper-scope-lifetime-review",
    });
    findings.push(
      makeFinding({
        ruleId: "EV004",
        node: call,
        file,
        owner,
        symbol: callMember(call),
        judgment: !wholeBody,
        ...(wholeBody ? {} : { className: scopeClass }),
      })
    );
  }
};

const detectResultAssertion = (
  { call, canonicalMember, inTest }: ReturnType<typeof inspectContext>,
  state: DetectorState
): void => {
  const { imports, makeFinding, findings, file, owner } = state;

  if (
    inTest &&
    canonicalMember === "result" &&
    isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["result"]) &&
    assertedOutcome(call, imports)
  ) {
    findings.push(makeFinding({ ruleId: "EV005", node: call, file, owner, symbol: callMember(call) }));
  }
};

const dataShapeDescription = (node: MorphNode | undefined, imports: EffectVitestImports) => {
  if (!Node.isCallExpression(node)) return O.none<{ readonly family: string; readonly member: string }>();
  return A.head(
    A.getSomes(
      A.map(
        [
          { family: "Option", modules: OPTION_MODULES, members: ["isSome", "isNone", "some", "none"] },
          { family: "Result", modules: RESULT_MODULES, members: ["isSuccess", "isFailure", "succeed", "fail"] },
          { family: "Exit", modules: EXIT_MODULES, members: ["isSuccess", "isFailure", "succeed", "fail"] },
        ],
        ({ family, modules, members }) =>
          A.findFirst(members, (member) => isProvenanceCall(node, imports, modules, family, [member])).pipe(
            O.map((member) => ({ family, member }))
          )
      )
    )
  );
};

const booleanLiteral = (node: MorphNode | undefined): O.Option<boolean> => {
  if (node?.getKind() === SyntaxKind.TrueKeyword) return O.some(true);
  return node?.getKind() === SyntaxKind.FalseKeyword ? O.some(false) : O.none();
};

const ambiguousDataAssertion = EffectVitestReplacement.make({
  primitive: "utils.deepStrictEqual",
  sketch:
    "Review the complete compound/ambiguous assertion, preserving matcher polarity and operands. Do not replace a Boolean branch check with invented payload/error/Cause expectations.",
});
const constructorAssertionPrimitives = HashMap.fromIterable([
  ["Option:none", "utils.assertNone"],
  ["Option:some", "utils.assertSome"],
  ["Result:fail", "utils.assertFailure"],
  ["Result:succeed", "utils.assertSuccess"],
  ["Exit:succeed", "utils.assertExitSuccess"],
]);

const predicateAssertionReplacement = (family: string, member: string, truth: boolean): EffectVitestReplacement => {
  const none = family === "Option" && (member === "isNone") === truth;
  const booleanPrimitive = truth ? "utils.assertTrue" : "utils.assertFalse";
  const polarity = truth ? "true" : "false";
  return EffectVitestReplacement.make({
    primitive: none ? "utils.assertNone" : booleanPrimitive,
    sketch: none
      ? "Assert the original Option is None; preserve the existing predicate polarity."
      : `Preserve this ${family}.${member} Boolean branch check and its ${polarity} polarity. A payload assertion requires an independently supplied expected value/error/Cause; do not invent one.`,
  });
};

const constructorAssertionReplacement = (
  expected: MorphNode | undefined,
  imports: EffectVitestImports
): EffectVitestReplacement => {
  const constructor = dataShapeDescription(expected, imports).pipe(
    O.filter(({ member }) => !Str.startsWith("is")(member))
  );
  if (O.isNone(constructor) || !Node.isCallExpression(expected)) return ambiguousDataAssertion;
  const { family, member } = constructor.value;
  if (member !== "none" && expected.getArguments().length !== 1) return ambiguousDataAssertion;
  return EffectVitestReplacement.make({
    primitive: O.getOrElse(
      HashMap.get(constructorAssertionPrimitives, `${family}:${member}`),
      () => "utils.deepStrictEqual"
    ),
    sketch: `Review structural equality against the supplied ${family}.${member} constructor. Reuse only the existing expected operand; preserve matcher semantics. Exit.fail(error) does not supply the Cause required by assertExitFailure.`,
  });
};

const dataAssertionRoute = (
  actual: MorphNode | undefined,
  expected: MorphNode | undefined,
  truth: O.Option<boolean>,
  equality: boolean,
  imports: EffectVitestImports
) => {
  const predicate = O.all({
    shape: dataShapeDescription(actual, imports).pipe(O.filter(({ member }) => Str.startsWith("is")(member))),
    truth,
  });
  if (O.isSome(predicate)) {
    const replacement = predicateAssertionReplacement(
      predicate.value.shape.family,
      predicate.value.shape.member,
      predicate.value.truth
    );
    return { judgment: replacement.primitive !== "utils.assertNone", replacement };
  }
  return {
    judgment: true,
    replacement: equality ? constructorAssertionReplacement(expected, imports) : ambiguousDataAssertion,
  };
};

const expectMatcher = (call: CallExpression) => {
  let parent = call.getParent();
  const members = A.empty<string>();
  while (Node.isPropertyAccessExpression(parent)) {
    members.push(parent.getName());
    parent = parent.getParent();
  }
  return { call: Node.isCallExpression(parent) ? parent : call, members };
};

const matcherTruth = (member: string, expected: MorphNode | undefined): O.Option<boolean> => {
  if (member === "toBeTruthy") return O.some(true);
  if (member === "toBeFalsy") return O.some(false);
  return A.contains(["toBe", "toEqual", "toStrictEqual"], member) ? booleanLiteral(expected) : O.none();
};

const detectExpectDataShape = (
  { call, canonicalMember, inTest }: ReturnType<typeof inspectContext>,
  state: DetectorState
): void => {
  const { imports, makeFinding, findings, file, owner } = state;
  if (!inTest || canonicalMember !== "expect" || !isExpectCall(call, imports)) return;
  const matcher = expectMatcher(call);
  if (
    !A.some([...call.getArguments(), ...matcher.call.getArguments()], (argument) =>
      containsDataShape(argument, imports)
    )
  )
    return;
  const member = O.getOrElse(A.last(matcher.members), () => "");
  const modifiers = A.dropRight(matcher.members, 1);
  const supported = A.every(modifiers, (modifier) => modifier === "not") && modifiers.length <= 1;
  const negated = A.contains(modifiers, "not");
  const expected = matcher.call.getArguments()[0];
  const truth = supported
    ? matcherTruth(member, expected).pipe(O.map((value) => (negated ? !value : value)))
    : O.none();
  const route = dataAssertionRoute(
    call.getArguments()[0],
    expected,
    truth,
    supported && !negated && A.contains(["toEqual", "toStrictEqual"], member),
    imports
  );
  findings.push(makeFinding({ ruleId: "EV006", node: matcher.call, file, owner, symbol: "expect", ...route }));
};

const booleanAssertionTruth = (call: CallExpression, imports: EffectVitestImports): O.Option<boolean> => {
  if (
    isProvenanceCall(call, imports, ["@effect/vitest/utils"], "utils", ["assertFalse"]) ||
    isProvenanceCall(call, imports, VITEST_MODULES, "assert", ["isFalse"])
  )
    return O.some(false);
  if (
    isProvenanceCall(call, imports, ["node:assert", "node:assert/strict", "assert", "assert/strict"], "assert", [
      "equal",
      "strictEqual",
    ])
  )
    return booleanLiteral(call.getArguments()[1]);
  return O.some(true);
};

const detectBooleanDataShape = (
  { call, member, inTest }: ReturnType<typeof inspectContext>,
  state: DetectorState
): void => {
  const { imports, makeFinding, findings, file, owner } = state;
  if (
    !inTest ||
    !isBooleanAssertion(call, imports) ||
    !A.some(call.getArguments(), (argument) => containsDataShape(argument, imports))
  )
    return;
  const route = dataAssertionRoute(
    call.getArguments()[0],
    undefined,
    booleanAssertionTruth(call, imports),
    false,
    imports
  );
  findings.push(makeFinding({ ruleId: "EV006", node: call, file, owner, symbol: member, ...route }));
};

const isLegacyPropertyAssertion = (
  { call, canonicalMember }: ReturnType<typeof inspectContext>,
  imports: EffectVitestImports
): boolean =>
  canonicalMember === "assert" &&
  isProvenanceCall(call, imports, FAST_CHECK_MODULES, "FastCheck", ["assert"]) &&
  O.exists(
    A.head(call.getArguments()),
    (property) =>
      Node.isCallExpression(property) &&
      isProvenanceCall(property, imports, FAST_CHECK_MODULES, "FastCheck", ["property", "asyncProperty"])
  );

const detectPropertyAssertion = (context: ReturnType<typeof inspectContext>, state: DetectorState): void => {
  const { call, inTest, helper } = context;
  const { imports, makeFinding, findings, file, owner } = state;
  if (!inTest && O.isNone(helper)) return;
  const native = isNativePropertyCheck(call, imports);
  if (!native && !isLegacyPropertyAssertion(context, imports)) return;
  const shared = O.exists(helper, ({ shared }) => shared);
  findings.push(
    makeFinding({
      ruleId: "EV007",
      node: call,
      file,
      owner,
      symbol: callMember(call),
      judgment: shared,
      ...(shared
        ? { className: "shared-helper-property-assertion-review" }
        : native
          ? { className: "direct-arbitrary-check" }
          : {}),
    })
  );
};

const waitFunctionOwner = (node: MorphNode): O.Option<MorphNode> =>
  O.fromUndefinedOr(
    node.getFirstAncestor(
      (ancestor) =>
        Node.isArrowFunction(ancestor) ||
        Node.isFunctionExpression(ancestor) ||
        Node.isFunctionDeclaration(ancestor) ||
        Node.isMethodDeclaration(ancestor)
    )
  );

const yieldedInvocation = (call: CallExpression): boolean => {
  const parent = call.getParent();
  return (
    Node.isYieldExpression(parent) ||
    Node.isReturnStatement(parent) ||
    (Node.isArrowFunction(parent) && parent.getBody() === call)
  );
};

const immediateFunctionInvocation = (owner: MorphNode): O.Option<CallExpression> => {
  let expression = owner;
  let parent = expression.getParent();
  while (Node.isParenthesizedExpression(parent)) {
    expression = parent;
    parent = expression.getParent();
  }
  return Node.isCallExpression(parent) && parent.getExpression() === expression && yieldedInvocation(parent)
    ? O.some(parent)
    : O.none();
};

const localWaitInvocations = (owner: MorphNode, state: DetectorState): ReadonlyArray<CallExpression> => {
  const binding: O.Option<MorphNode> = Node.isFunctionDeclaration(owner)
    ? O.some(owner)
    : O.fromUndefinedOr(owner.getFirstAncestorByKind(SyntaxKind.VariableDeclaration));
  return O.match(binding, {
    onNone: A.empty<CallExpression>,
    onSome: (value) =>
      A.filter(state.calls, (call) => {
        const expression = call.getExpression();
        return (
          Node.isIdentifier(expression) &&
          O.exists(state.imports.resolveBinding(expression), (resolved) => resolved === value)
        );
      }),
  });
};

const directWaitFunction = (owner: MorphNode, state: DetectorState, seen: ReadonlyArray<MorphNode>): boolean => {
  const parent = owner.getParent();
  if (Node.isCallExpression(parent) && isProvenanceCall(parent, state.imports, EFFECT_MODULES, "Effect", ["gen"]))
    return directWaitExecution(parent, state, seen);
  const immediate = immediateFunctionInvocation(owner);
  if (O.isSome(immediate)) return directWaitExecution(immediate.value, state, seen);
  if (
    O.exists(
      state.harness.reachableHelper(O.getOrElse(A.head(owner.forEachChildAsArray()), () => owner)),
      ({ shared }) => shared
    )
  )
    return false;
  const invocations = localWaitInvocations(owner, state);
  return (
    invocations.length > 0 &&
    A.every(invocations, (call) => yieldedInvocation(call) && directWaitExecution(call, state, seen))
  );
};

const directWaitExecution = (node: MorphNode, state: DetectorState, seen: ReadonlyArray<MorphNode> = []): boolean => {
  const owner = waitFunctionOwner(node);
  if (O.isNone(owner) || A.contains(seen, owner.value)) return false;
  if (
    O.exists(state.harness.enclosingTest(node), ({ callback, mode }) => callback === owner.value && mode === "effect")
  )
    return true;
  return directWaitFunction(owner.value, state, [...seen, owner.value]);
};

const clockWaitCall = (call: CallExpression, imports: EffectVitestImports): boolean =>
  isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["sleep"]) ||
  isProvenanceCall(call, imports, SCHEDULE_MODULES, "Schedule", ["spaced", "fixed", "exponential"]);

const clockWaitClassification = (call: CallExpression, state: DetectorState) => {
  const controlled = O.exists(state.harness.enclosingTest(call), ({ callback }) =>
    controlledWait(call, callback, state.imports)
  );
  if (controlled) return { judgment: true, className: "controlled-clock-wait-review" };
  if (directWaitExecution(call, state)) return { judgment: false };
  return {
    judgment: true,
    className: "deferred-clock-wait-review",
    replacement: EffectVitestReplacement.make({
      primitive: "readme.testclock",
      sketch:
        "Review deferred or uncertain helper/service execution and its clock owner; this wait is not proven to stall direct registration execution.",
    }),
  };
};

const detectClockWait = (
  { call, test, testClockMode }: ReturnType<typeof inspectContext>,
  state: DetectorState
): void => {
  const { imports, harness, makeFinding, findings, file, owner } = state;
  if (!clockWaitCall(call, imports) || liveClockFor(call, imports)) return;
  const helper = O.isNone(test) && O.exists(harness.reachableHelper(call), ({ testClock }) => testClock);
  if (!testClockMode && !helper) return;
  findings.push(
    makeFinding({
      ruleId: "EV008",
      node: call,
      file,
      owner,
      symbol: callMember(call),
      ...clockWaitClassification(call, state),
    })
  );
};

const detectLiveMode = ({ call }: ReturnType<typeof inspectContext>, state: DetectorState): void => {
  const { imports, makeFinding, findings, file, owner } = state;

  if (isHarnessMethodCall(call, imports, "live")) {
    const callbacks = effectVitestTestCallbacks(call, imports);
    if (A.isReadonlyArrayNonEmpty(callbacks) && !A.some(callbacks, (callback) => liveServiceCall(callback, imports)))
      findings.push(makeFinding({ ruleId: "EV009", node: call, file, owner, symbol: "it.live", judgment: true }));
  }
};

const detectServiceMock = ({ call, member }: ReturnType<typeof inspectContext>, state: DetectorState): void => {
  const { imports, makeFinding, findings, file, owner } = state;

  if (
    A.contains(["mock", "spyOn"], member) &&
    isProvenanceCall(call, imports, VITEST_MODULES, "vi", ["mock", "spyOn", "vi.mock", "vi.spyOn"]) &&
    O.isSome(serviceMockTarget(call, imports))
  ) {
    findings.push(
      makeFinding({
        ruleId: "EV012",
        node: call,
        file,
        owner,
        symbol: callLabel(call),
        judgment: true,
        className: O.getOrElse(serviceMockTarget(call, imports), () => "unproven-module-mock-review"),
      })
    );
  }
};

const detectLayerTimeout = ({ call }: ReturnType<typeof inspectContext>, state: DetectorState): void => {
  const { imports, makeFinding, findings, file, owner } = state;

  if (isHarnessMethodCall(call, imports, "layer") && !Node.isCallExpression(call.getExpression())) {
    const layer = call.getArguments()[0];
    if (Node.isExpression(layer) && !isPureStubLayer(layer, imports) && !layerHasTimeout(call)) {
      findings.push(makeFinding({ ruleId: "EV014", node: call, file, owner, symbol: "it.layer", judgment: true }));
    }
  }
};

const detectLayerClockReset = ({ call, member }: ReturnType<typeof inspectContext>, state: DetectorState): void => {
  const { imports, harness, makeFinding, findings, file, owner } = state;

  if (member === "adjust" && isProvenanceCall(call, imports, TEST_CLOCK_MODULES, "TestClock", ["adjust"])) {
    const layer = harness.enclosingLayerBlock(call);
    if (O.isSome(layer)) {
      findings.push(
        makeFinding({ ruleId: "EV015", node: call, file, owner, symbol: "TestClock.adjust", judgment: true })
      );
    }
  }
};

const inspectCall = (call: CallExpression, state: DetectorState): void => {
  const { imports, helperNames } = state;

  const member = callMember(call);
  const canonicalMember = Node.isIdentifier(call.getExpression())
    ? O.getOrElse(
        O.map(
          A.head(O.getOrElse(MutableHashMap.get(imports.bindingsByLocal, member), A.empty)),
          (binding) => binding.imported
        ),
        () => member
      )
    : member;
  if (
    !wrapperName(member) &&
    !wrapperName(canonicalMember) &&
    !A.contains(helperNames, member) &&
    !HashSet.has(detectorCallMembers, canonicalMember)
  )
    return;
  const context = inspectContext(call, member, canonicalMember, state);
  detectRuntimeBoundary(context, state);
  detectLayerProvision(context, state);
  detectResourceWrapper(context, state);
  detectScopeLifetime(context, state);
  detectResultAssertion(context, state);
  detectExpectDataShape(context, state);
  detectBooleanDataShape(context, state);
  detectPropertyAssertion(context, state);
  detectClockWait(context, state);
  detectLiveMode(context, state);
  detectServiceMock(context, state);
  detectLayerTimeout(context, state);
  detectLayerClockReset(context, state);
};

const emitPlatformFinding = (
  node: MorphNode,
  moduleName: string,
  members: ReadonlyArray<string>,
  osTemp: boolean,
  state: DetectorState
): void => {
  const { makeFinding, findings, file, owner } = state;
  const filesystemMember = moduleName === "@effect/platform-bun" ? "BunFileSystem" : "NodeFileSystem";
  const filesystem = platformFileSystemImport(moduleName) || osTemp || A.contains(members, filesystemMember);
  if (!filesystem && !platformResourceReview(moduleName, members)) return;
  const review = filesystem
    ? {}
    : {
        className: "platform-resource-provenance-review",
        replacement: EffectVitestReplacement.make({
          primitive: "it.layer",
          sketch:
            "Review opaque platform resource provenance; filesystem use is unproven. Preserve the subject and identify actual services before selecting a filesystem layer.",
        }),
      };
  findings.push(makeFinding({ ruleId: "EV010", node, file, owner, symbol: moduleName, judgment: true, ...review }));
};

const detectPlatformImport = (declaration: ImportDeclaration, state: DetectorState): void => {
  const { imports, calls } = state;
  if (declaration.isTypeOnly()) return;
  const moduleName = declaration.getModuleSpecifierValue();
  const osTemp =
    A.contains(["node:os", "os"], moduleName) &&
    A.some(calls, (call) => isProvenanceCall(call, imports, ["node:os", "os"], "os", ["tmpdir"]));
  const members = A.contains(platformMemberModules, moduleName) ? platformImportedMembers(declaration, imports) : [];
  emitPlatformFinding(declaration, moduleName, members, osTemp, state);
};

const requiredTmpdirNames = (declaration: MorphNode): ReadonlyArray<string> => {
  if (!Node.isVariableDeclaration(declaration)) return [];
  const name = declaration.getNameNode();
  if (!Node.isObjectBindingPattern(name)) return [];
  return A.map(
    A.filter(
      name.getElements(),
      (element) => (element.getPropertyNameNode() ?? element.getNameNode()).getText() === "tmpdir"
    ),
    (element) => element.getName()
  );
};

const requiredOsTemp = (call: CallExpression, declaration: MorphNode, state: DetectorState): boolean => {
  const names = requiredTmpdirNames(declaration);
  return A.some(state.calls, (candidate) => {
    const access = candidate.getExpression();
    if (Node.isIdentifier(access))
      return (
        A.contains(names, access.getText()) &&
        O.exists(state.imports.resolveBinding(access), (binding) => binding === declaration)
      );
    if (!Node.isPropertyAccessExpression(access) || access.getName() !== "tmpdir") return false;
    const receiver = access.getExpression();
    return (
      receiver === call ||
      (Node.isIdentifier(receiver) &&
        O.exists(state.imports.resolveBinding(receiver), (binding) => binding === declaration))
    );
  });
};

const detectPlatformRequire = (call: CallExpression, state: DetectorState): void => {
  const callee = call.getExpression();
  const argument = call.getArguments()[0];
  if (
    !Node.isIdentifier(callee) ||
    callee.getText() !== "require" ||
    O.isSome(state.imports.resolveBinding(callee)) ||
    !Node.isStringLiteral(argument)
  )
    return;
  const declaration = call.getFirstAncestorByKind(SyntaxKind.VariableDeclaration) ?? call;
  const moduleName = argument.getLiteralValue();
  const osTemp = A.contains(["node:os", "os"], moduleName) && requiredOsTemp(call, declaration, state);
  const members = A.contains(platformMemberModules, moduleName) ? platformRequiredMembers(call, state.imports) : [];
  emitPlatformFinding(declaration, moduleName, members, osTemp, state);
};

const detectResourceDefinition = (
  { name, node }: ReturnType<typeof sourceFunctionDefinitions>[number],
  state: DetectorState
): void => {
  const { imports, findings, makeFinding, file, owner } = state;
  if ((wrapperName(name) && functionHasResource(node, imports)) || buildsAndProvidesLayer(node, imports))
    findings.push(
      makeFinding({ ruleId: "EV003", node, file, owner, symbol: name, judgment: !functionHasResource(node, imports) })
    );
};

const detectRetryLoop = (loop: MorphNode, state: DetectorState): void => {
  const { harness, imports, findings, makeFinding, file, owner } = state;
  if (O.isSome(harness.enclosingTest(loop)) && loopIsRetryCandidate(loop, imports))
    findings.push(makeFinding({ ruleId: "EV013", node: loop, file, owner, symbol: "retry-loop", judgment: true }));
};

/**
 * Detect EV001 through EV015 in one parsed source file without semantic type queries.
 *
 * **Details**
 *
 * Mechanical predicates produce detector rows; semantic uncertainty is retained
 * as lower-confidence judgment rows instead of being asserted or discarded.
 *
 * **Example** (Detect a plain-test runtime boundary)
 *
 * ```ts
 * import { detectEffectVitestFindings } from "@beep/repo-cli/commands/Lint"
 * import * as A from "effect/Array"
 * import { Project } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "runtime.test.ts",
 *   'import { Effect } from "effect"; import { it } from "@effect/vitest"; it("runs", () => Effect.runSync(program))'
 * )
 * const findings = detectEffectVitestFindings(source, "packages/example/test/runtime.test.ts", "@beep/example")
 * console.log(A.map(findings, ({ ruleId }) => ruleId)) // ["EV001"]
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const detectEffectVitestFindings: {
  (sourceFile: SourceFile, file: string, owner: string): ReadonlyArray<EffectVitestFinding>;
  (file: string, owner: string): (sourceFile: SourceFile) => ReadonlyArray<EffectVitestFinding>;
} = dual(3, (sourceFile: SourceFile, file: string, owner: string) => {
  const imports = collectEffectVitestImports(sourceFile);
  const harness = createEffectVitestHarnessIndex(sourceFile, imports);
  const statementDigests = MutableHashMap.empty<number, string>();
  const makeFinding = (input: FindingInput): EffectVitestFinding =>
    EffectVitestFinding.make({
      ...initialFinding(input),
      occurrence: O.some(occurrenceAnchor(input.node, imports, statementDigests)),
    });
  const findings = A.empty<EffectVitestFinding>();
  const definitions = A.filter(
    sourceFunctionDefinitions(sourceFile),
    ({ node }) => functionHasResource(node, imports) || buildsAndProvidesLayer(node, imports)
  );
  const helperNames = A.map(definitions, ({ name }) => name);
  const calls = imports.calls;
  const state: DetectorState = {
    imports,
    harness,
    makeFinding,
    findings,
    definitions,
    helperNames,
    calls,
    file,
    owner,
  };

  for (const call of calls) inspectCall(call, state);

  for (const definition of definitions) detectResourceDefinition(definition, state);
  for (const declaration of imports.plainVitestImports) {
    if (imports.hasEffectImport)
      findings.push(makeFinding({ ruleId: "EV011", node: declaration, file, owner, symbol: "vitest-import" }));
  }

  for (const declaration of sourceFile.getImportDeclarations()) detectPlatformImport(declaration, state);

  for (const call of calls) detectPlatformRequire(call, state);
  for (const loop of imports.loops) detectRetryLoop(loop, state);
  return assignStableIds(findings);
});
