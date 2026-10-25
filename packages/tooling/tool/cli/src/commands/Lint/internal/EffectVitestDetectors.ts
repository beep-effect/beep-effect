/** Syntax-only EV001-EV015 detectors. @packageDocumentation @since 0.0.0 */

import { A, Str } from "@beep/utils";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import { constFalse, constTrue, dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import { Node, SyntaxKind, ts } from "ts-morph";
import { EffectVitestLintError } from "../Lint.errors.ts";
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
import type { LazyArg } from "effect/Function";
import type {
  CallExpression,
  ClassDeclaration,
  ExportDeclaration,
  Expression,
  Identifier,
  ImportDeclaration,
  MethodDeclaration,
  Node as MorphNode,
  SourceFile,
  VariableDeclaration,
  YieldExpression,
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
const ATOM_REGISTRY_MODULES = ["effect/reactivity", "effect/reactivity/AtomRegistry"];
const LOGGER_MODULES = ["effect", "effect/Logger"];
const FETCH_HTTP_CLIENT_MODULES = ["effect/http", "effect/http/FetchHttpClient"];
const LANGUAGE_MODEL_MODULES = ["effect/ai", "effect/ai/LanguageModel"];
const ARBITRARY_MODULES = ["effect", "effect/Arbitrary"];
const FAST_CHECK_MODULES = ["effect/testing", "effect/testing/FastCheck", "fast-check"];
const VITEST_MODULES = ["@effect/vitest", "vitest"];
const REF_MODULES = ["effect", "effect/Ref"];
const CONFIG_PROVIDER_MODULES = ["effect", "effect/ConfigProvider"];

// A fixed dispatch index avoids scanning the full member list for every call.
const detectorCallMembers = HashSet.fromIterable([
  "pipe",
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

type LayerLeaf = (expression: Expression, imports: EffectVitestImports) => boolean;

// Follows Layer.merge/mergeAll operands and const initializers down to leaves.
const layerComposedOf =
  (leaf: LayerLeaf) =>
  (expression: Expression, imports: EffectVitestImports): boolean => {
    const visit = (current: Expression, seen: ReadonlyArray<string>): boolean => {
      if (leaf(current, imports)) return true;
      if (Node.isCallExpression(current))
        return (
          isProvenanceCall(current, imports, LAYER_MODULES, "Layer", ["merge", "mergeAll"]) &&
          A.every(current.getArguments(), (argument) => Node.isExpression(argument) && visit(argument, seen))
        );
      if (!Node.isIdentifier(current) || A.contains(seen, current.getText())) return false;
      return O.exists(localInitializer(current, imports), (initializer) =>
        visit(initializer, [...seen, current.getText()])
      );
    };
    return visit(expression, []);
  };

const isStubLayerLeaf: LayerLeaf = (expression, imports) =>
  Node.isCallExpression(expression)
    ? isProvenanceCall(expression, imports, LAYER_MODULES, "Layer", ["succeed", "mock"])
    : isProvenanceExpression(expression, imports, LAYER_MODULES, "Layer", ["empty"]);

const isPureStubLayer = layerComposedOf(isStubLayerLeaf);

// Platform service bundles build in-process services and acquire no external
// resource, so a hook timeout guards nothing.
const platformServiceLayerModules = A.flatMap(
  [
    { runtime: "Node", root: "@effect/platform-node" },
    { runtime: "Bun", root: "@effect/platform-bun" },
  ],
  ({ runtime, root }) =>
    A.map(["Services", "FileSystem", "Path", "Crypto", "ChildProcessSpawner", "Stdio", "Terminal"], (service) => ({
      name: `${runtime}${service}`,
      root,
    }))
);

const isPlatformServiceLayer: LayerLeaf = (expression, imports) =>
  !Node.isCallExpression(expression) &&
  A.some(platformServiceLayerModules, ({ name, root }) =>
    isProvenanceExpression(expression, imports, [root, `${root}/${name}`], name, ["layer", `${name}.layer`])
  );

// --- EV014 test-layer acquisition (#1855 wave 6) -----------------------------------------------
//
// EV014 asks whether the layer an `it.layer` block builds in its hook acquires something a hook
// budget should bound. A layer is acquisition-free when every leaf it composes is a stub
// (`succeed`/`sync`/`mock`/`empty`/`succeedContext`), a platform service bundle, a named
// in-memory library layer, or a hermetic in-memory acquisition: a `Layer.effect` or
// `Layer.unwrap` whose effect only reads services and allocates Effect state. References are
// followed through same-file bindings, imports into other repository sources (bundler-style
// module resolution, as vitest resolves them), class static members and factory calls, whose
// parameters are bound to the call's arguments. Anything unresolved acquires.

// Bundler resolution: package `exports`, `.ts` extension imports and extensionless relatives.
const LAYER_RESOLUTION_OPTIONS: ts.CompilerOptions = {
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
  noEmit: true,
};
const LAYER_SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];
const LAYER_ANALYSIS_DEPTH = 24;

type LayerFunction = EffectVitestFunctionNode | MethodDeclaration;
// `argument` is `None` when the call cannot say which value the parameter receives (at or after a
// spread argument), so neither a positional argument nor the parameter's default may stand in for it.
type LayerBinding = { readonly parameter: MorphNode; readonly argument: O.Option<Expression>; readonly env: LayerEnv };
type LayerEnv = ReadonlyArray<LayerBinding>;
type LayerEntity =
  | { readonly _tag: "Value"; readonly expression: Expression; readonly env: LayerEnv }
  | { readonly _tag: "Function"; readonly definition: LayerFunction; readonly env: LayerEnv }
  | { readonly _tag: "Class"; readonly declaration: ClassDeclaration }
  | { readonly _tag: "Module"; readonly source: SourceFile };

/**
 * Per-file EV014 resolution context: import contexts of reached sources and resolved modules.
 * Both caches live for one `detectEffectVitestFindings` call, like the file's own AST caches.
 */
type LayerAnalysis = {
  readonly importsOf: (source: SourceFile) => EffectVitestImports;
  readonly moduleSource: (from: SourceFile, specifier: string) => O.Option<SourceFile>;
};

const makeLayerAnalysis = (sourceFile: SourceFile, imports: EffectVitestImports): LayerAnalysis => {
  // Keyed by file path: both caches live only for this call, so weak identity buys nothing.
  const contexts = MutableHashMap.empty<string, EffectVitestImports>();
  MutableHashMap.set(contexts, sourceFile.getFilePath(), imports);
  const modules = MutableHashMap.empty<string, O.Option<SourceFile>>();
  const importsOf = (source: SourceFile): EffectVitestImports => {
    const key = source.getFilePath();
    const cached = MutableHashMap.get(contexts, key);
    if (O.isSome(cached)) return cached.value;
    const collected = collectEffectVitestImports(source);
    MutableHashMap.set(contexts, key, collected);
    return collected;
  };
  // A wrapped node outside any Project has no module resolution host, so nothing resolves.
  const resolveSource = (from: SourceFile, specifier: string): O.Option<SourceFile> =>
    O.flatMap(O.liftThrowable(() => from.getProject())(), (project) =>
      O.flatMap(
        O.fromUndefinedOr(
          ts.resolveModuleName(
            specifier,
            from.getFilePath(),
            LAYER_RESOLUTION_OPTIONS,
            project.getModuleResolutionHost()
          ).resolvedModule
        ),
        ({ extension, resolvedFileName }) =>
          // Declaration files and installed packages carry no initializer to classify.
          A.contains(LAYER_SOURCE_EXTENSIONS, extension) && !Str.includes("/node_modules/")(resolvedFileName)
            ? O.fromUndefinedOr(
                project.getSourceFile(resolvedFileName) ?? project.addSourceFileAtPathIfExists(resolvedFileName)
              )
            : O.none()
      )
    );
  const moduleSource = (from: SourceFile, specifier: string): O.Option<SourceFile> => {
    const key = `${from.getFilePath()}\u0000${specifier}`;
    const cached = MutableHashMap.get(modules, key);
    if (O.isSome(cached)) return cached.value;
    const resolved = resolveSource(from, specifier);
    MutableHashMap.set(modules, key, resolved);
    return resolved;
  };
  return { importsOf, moduleSource };
};

// ts-morph's `isFunctionLikeDeclaration` omits function expressions such as `Effect.gen(function* () {})`,
// so a statement's own function is found with both predicates.
const isFunctionBoundary = (node: MorphNode): boolean =>
  Node.isFunctionLikeDeclaration(node) || Node.isFunctionExpression(node);

const stripLayerExpression = (expression: Expression): Expression => {
  let current: Expression = expression;
  while (
    Node.isParenthesizedExpression(current) ||
    Node.isAsExpression(current) ||
    Node.isSatisfiesExpression(current) ||
    Node.isNonNullExpression(current) ||
    Node.isTypeAssertion(current)
  )
    current = current.getExpression();
  return current;
};

const isLayerFunctionNode = (node: MorphNode): node is LayerFunction =>
  Node.isArrowFunction(node) ||
  Node.isFunctionExpression(node) ||
  Node.isFunctionDeclaration(node) ||
  Node.isMethodDeclaration(node);

const valueEntity = (expression: Expression, env: LayerEnv): LayerEntity => {
  const value = stripLayerExpression(expression);
  return isLayerFunctionNode(value)
    ? { _tag: "Function", definition: value, env }
    : { _tag: "Value", expression: value, env };
};

const parameterEntity = (parameter: MorphNode, env: LayerEnv): O.Option<LayerEntity> =>
  O.match(
    A.findFirst(env, (binding) => binding.parameter === parameter),
    {
      onNone: () =>
        Node.isParameterDeclaration(parameter)
          ? O.map(O.fromUndefinedOr(parameter.getInitializer()), (initializer) => valueEntity(initializer, env))
          : O.none(),
      onSome: ({ argument, env: argumentEnv }) => O.map(argument, (value) => valueEntity(value, argumentEnv)),
    }
  );

const importEntity = (
  declaration: ImportDeclaration,
  name: string,
  analysis: LayerAnalysis,
  depth: number
): O.Option<LayerEntity> => {
  const source = declaration.getSourceFile();
  return O.flatMap(
    A.findFirst(
      O.getOrElse(MutableHashMap.get(analysis.importsOf(source).bindingsByLocal, name), A.empty),
      (binding) => binding.declaration === declaration
    ),
    (binding) =>
      O.flatMap(analysis.moduleSource(source, binding.module), (target) =>
        binding.imported === "*"
          ? O.some<LayerEntity>({ _tag: "Module", source: target })
          : moduleExport(target, binding.imported, analysis, depth + 1)
      )
  );
};

const declarationEntity = (
  declaration: MorphNode,
  name: string,
  env: LayerEnv,
  analysis: LayerAnalysis,
  depth: number
): O.Option<LayerEntity> => {
  if (Node.isVariableDeclaration(declaration))
    return declaration.getName() === name
      ? O.map(O.fromUndefinedOr(declaration.getInitializer()), (initializer) => valueEntity(initializer, []))
      : O.none();
  if (Node.isFunctionDeclaration(declaration)) return O.some({ _tag: "Function", definition: declaration, env: [] });
  if (Node.isClassDeclaration(declaration)) return O.some({ _tag: "Class", declaration });
  if (Node.isParameterDeclaration(declaration)) return parameterEntity(declaration, env);
  return Node.isImportDeclaration(declaration) && !declaration.isTypeOnly()
    ? importEntity(declaration, name, analysis, depth)
    : O.none();
};

// An exported `const`, `function` or `class` declared in the module itself.
const declaredExport = (source: SourceFile, name: string): O.Option<MorphNode> =>
  A.findFirst(source.getStatements(), (statement): O.Option<MorphNode> => {
    if (Node.isVariableStatement(statement))
      return statement.hasExportKeyword()
        ? A.findFirst(statement.getDeclarations(), (candidate) => candidate.getName() === name)
        : O.none();
    return (Node.isFunctionDeclaration(statement) || Node.isClassDeclaration(statement)) &&
      statement.hasExportKeyword() &&
      statement.getName() === name
      ? O.some(statement)
      : O.none();
  });

// `export * as name from`, `export { local as name } from` or a local `export { local as name }`.
const namedReExport = (
  statement: ExportDeclaration,
  name: string,
  analysis: LayerAnalysis,
  depth: number
): O.Option<LayerEntity> => {
  const source = statement.getSourceFile();
  const specifier = O.fromUndefinedOr(statement.getModuleSpecifierValue());
  if (statement.getNamespaceExport()?.getName() === name)
    return O.map(
      O.flatMap(specifier, (module) => analysis.moduleSource(source, module)),
      (target): LayerEntity => ({ _tag: "Module", source: target })
    );
  return O.flatMap(
    A.findFirst(
      statement.getNamedExports(),
      (exported) => !exported.isTypeOnly() && (exported.getAliasNode()?.getText() ?? exported.getName()) === name
    ),
    (exported) =>
      O.match(specifier, {
        onNone: () => {
          const local = exported.getNameNode();
          return Node.isIdentifier(local) ? resolveLayerIdentifier(local, [], analysis, depth + 1) : O.none();
        },
        onSome: (module) =>
          O.flatMap(analysis.moduleSource(source, module), (target) =>
            moduleExport(target, exported.getName(), analysis, depth + 1)
          ),
      })
  );
};

const starExport = (
  statement: ExportDeclaration,
  name: string,
  analysis: LayerAnalysis,
  depth: number
): O.Option<LayerEntity> =>
  statement.hasNamedExports() || statement.getNamespaceExport() !== undefined
    ? O.none()
    : O.flatMap(O.fromUndefinedOr(statement.getModuleSpecifierValue()), (module) =>
        O.flatMap(analysis.moduleSource(statement.getSourceFile(), module), (target) =>
          moduleExport(target, name, analysis, depth + 1)
        )
      );

// Syntax-only export lookup: exported declarations, then named and namespace re-exports, then
// `export *` targets. Type-only exports never carry a layer.
const moduleExport = (
  source: SourceFile,
  name: string,
  analysis: LayerAnalysis,
  depth: number
): O.Option<LayerEntity> => {
  if (depth > LAYER_ANALYSIS_DEPTH) return O.none();
  const exports = A.filter(source.getExportDeclarations(), (statement) => !statement.isTypeOnly());
  return O.flatMap(declaredExport(source, name), (declaration) =>
    declarationEntity(declaration, name, [], analysis, depth)
  ).pipe(
    O.orElse(() => A.findFirst(exports, (statement) => namedReExport(statement, name, analysis, depth))),
    O.orElse(() => A.findFirst(exports, (statement) => starExport(statement, name, analysis, depth)))
  );
};

const resolveLayerIdentifier = (
  identifier: Identifier,
  env: LayerEnv,
  analysis: LayerAnalysis,
  depth: number
): O.Option<LayerEntity> =>
  depth > LAYER_ANALYSIS_DEPTH
    ? O.none()
    : O.flatMap(analysis.importsOf(identifier.getSourceFile()).resolveBinding(identifier), (declaration) =>
        declarationEntity(declaration, identifier.getText(), env, analysis, depth)
      );

const resolveLayerReference = (
  expression: Expression,
  env: LayerEnv,
  analysis: LayerAnalysis,
  depth: number
): O.Option<LayerEntity> => {
  const reference = stripLayerExpression(expression);
  if (Node.isIdentifier(reference)) return resolveLayerIdentifier(reference, env, analysis, depth);
  if (!Node.isPropertyAccessExpression(reference)) return O.none();
  const base = stripLayerExpression(reference.getExpression());
  const owner =
    base.getKind() === SyntaxKind.ThisKeyword
      ? O.map(O.fromUndefinedOr(base.getFirstAncestorByKind(SyntaxKind.ClassDeclaration)), (declaration) => ({
          _tag: "Class" as const,
          declaration,
        }))
      : resolveLayerReference(base, env, analysis, depth + 1);
  return O.flatMap(owner, (entity): O.Option<LayerEntity> => {
    if (entity._tag === "Module") return moduleExport(entity.source, reference.getName(), analysis, depth + 1);
    if (entity._tag !== "Class") return O.none();
    const property = entity.declaration.getStaticProperty(reference.getName());
    if (Node.isPropertyDeclaration(property))
      return O.map(O.fromUndefinedOr(property.getInitializer()), (initializer) => valueEntity(initializer, []));
    return O.map(
      O.fromUndefinedOr(entity.declaration.getStaticMethod(reference.getName())),
      (definition): LayerEntity => ({ _tag: "Function", definition, env: [] })
    );
  });
};

// The implementation of `dual(arity, implementation)` from effect/Function.
const dualImplementation = (value: Expression, analysis: LayerAnalysis): O.Option<Expression> => {
  if (!Node.isCallExpression(value) || value.getArguments().length !== 2) return O.none();
  const implementation = value.getArguments()[1];
  return Node.isExpression(implementation) &&
    isProvenanceCall(value, analysis.importsOf(value.getSourceFile()), ["effect", "effect/Function"], "Function", [
      "dual",
    ])
    ? O.some(implementation)
    : O.none();
};

// A callee through aliases (`const make = makeInMemory`) and `dual(arity, implementation)`.
const resolveLayerCallee = (
  callee: Expression,
  env: LayerEnv,
  analysis: LayerAnalysis,
  depth: number
): O.Option<LayerEntity> =>
  O.flatMap(resolveLayerReference(callee, env, analysis, depth), (entity) => {
    if (entity._tag !== "Value" || depth > LAYER_ANALYSIS_DEPTH) return O.some(entity);
    const value = entity.expression;
    if (Node.isIdentifier(value) || Node.isPropertyAccessExpression(value))
      return resolveLayerCallee(value, entity.env, analysis, depth + 1);
    return O.some(
      O.match(dualImplementation(value, analysis), {
        onNone: () => entity,
        onSome: (implementation) => valueEntity(implementation, entity.env),
      })
    );
  });

const layerFunctionReturns = (definition: LayerFunction): ReadonlyArray<Expression> => {
  const body = definition.getBody();
  if (body === undefined) return [];
  if (!Node.isBlock(body)) return Node.isExpression(body) ? [body] : [];
  return A.getSomes(
    A.map(
      A.filter(
        body.getDescendantsOfKind(SyntaxKind.ReturnStatement),
        (statement) => statement.getFirstAncestor(isFunctionBoundary) === definition
      ),
      (statement) => O.fromUndefinedOr(statement.getExpression())
    )
  );
};

type LayerJudge = (expression: Expression, env: LayerEnv, analysis: LayerAnalysis, depth: number) => boolean;

// Parameters bound to a call's positional arguments, ahead of the definition's own bindings. Positions
// hold only before the first spread argument: every parameter at or after it binds to an unknown value.
const bindArguments = (
  definition: LayerFunction,
  argumentsOf: ReadonlyArray<MorphNode>,
  callerEnv: LayerEnv,
  definitionEnv: LayerEnv
): LayerEnv => {
  // Without a spread every position is known; a missing argument then falls back to the parameter's default.
  const firstSpread = O.getOrElse(A.findFirstIndex(argumentsOf, Node.isSpreadElement), () => Number.POSITIVE_INFINITY);
  return [
    ...A.getSomes(
      A.map(definition.getParameters(), (parameter, index): O.Option<LayerBinding> => {
        if (parameter.isRestParameter()) return O.none();
        if (index >= firstSpread) return O.some({ parameter, argument: O.none(), env: callerEnv });
        const argument = argumentsOf[index];
        return Node.isExpression(argument)
          ? O.some({ parameter, argument: O.some(argument), env: callerEnv })
          : O.none();
      })
    ),
    ...definitionEnv,
  ];
};

// The generator of `Effect.fn(name)(function* () {})`, `Effect.fn(function* () {})` or
// `Effect.fnUntraced(function* () {})`. Extra pipeable arguments are not followed.
const effectFunctionGenerator = (expression: Expression, analysis: LayerAnalysis): O.Option<LayerFunction> => {
  if (!Node.isCallExpression(expression)) return O.none();
  const imports = analysis.importsOf(expression.getSourceFile());
  const callee = expression.getExpression();
  const defined =
    isProvenanceCall(expression, imports, EFFECT_MODULES, "Effect", ["fn", "fnUntraced"]) &&
    (!Node.isCallExpression(callee) ||
      A.every(
        callee.getArguments(),
        (argument) => Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument)
      ));
  const args = expression.getArguments();
  const generator = args[0];
  return defined &&
    args.length === 1 &&
    Node.isExpression(generator) &&
    isLayerFunctionNode(stripLayerExpression(generator))
    ? O.some(stripLayerExpression(generator) as LayerFunction)
    : O.none();
};

// Every return of a resolved function, judged with its parameters bound to the call's arguments.
const judgeFunctionReturns = (
  definition: LayerFunction,
  argumentsOf: ReadonlyArray<MorphNode>,
  callerEnv: LayerEnv,
  definitionEnv: LayerEnv,
  judge: LayerJudge,
  analysis: LayerAnalysis,
  depth: number
): boolean => {
  const returns = layerFunctionReturns(definition);
  const env = bindArguments(definition, argumentsOf, callerEnv, definitionEnv);
  return (
    A.isReadonlyArrayNonEmpty(returns) && A.every(returns, (returned) => judge(returned, env, analysis, depth + 1))
  );
};

// Follows a reference to its value, or a call to the returns of the function it resolves to.
const followLayerValue = (
  expression: Expression,
  env: LayerEnv,
  analysis: LayerAnalysis,
  depth: number,
  judge: LayerJudge
): boolean => {
  if (depth > LAYER_ANALYSIS_DEPTH) return false;
  const value = stripLayerExpression(expression);
  if (Node.isCallExpression(value))
    return O.exists(resolveLayerCallee(value.getExpression(), env, analysis, depth + 1), (entity) => {
      if (entity._tag === "Function")
        return judgeFunctionReturns(entity.definition, value.getArguments(), env, entity.env, judge, analysis, depth);
      // `Effect.fn(name)(function* (...) {})` and `Effect.fnUntraced(function* (...) {})` define effect
      // factories: the call runs the generator with its parameters bound to the arguments.
      return (
        entity._tag === "Value" &&
        judge === isHermeticEffect &&
        O.exists(effectFunctionGenerator(entity.expression, analysis), (generator) =>
          isHermeticGenerator(
            generator,
            bindArguments(generator, value.getArguments(), env, entity.env),
            analysis,
            depth
          )
        )
      );
    });
  return O.exists(
    resolveLayerReference(value, env, analysis, depth + 1),
    (entity) => entity._tag === "Value" && judge(entity.expression, entity.env, analysis, depth + 1)
  );
};

const callbackReturns = (
  callback: MorphNode | undefined,
  env: LayerEnv,
  analysis: LayerAnalysis,
  depth: number,
  judge: LayerJudge
): boolean => {
  if (callback === undefined || !Node.isExpression(callback)) return false;
  const value = stripLayerExpression(callback);
  return isLayerFunctionNode(value)
    ? judgeFunctionReturns(value, [], env, env, judge, analysis, depth)
    : judge(value, env, analysis, depth + 1);
};

const STUB_LAYER_MEMBERS = ["succeed", "sync", "mock", "succeedContext", "syncContext"];
const LAYER_COMPOSERS = ["merge", "mergeAll", "provide", "provideMerge", "fresh"];

// `ConfigProvider.layer(provider)` is `Layer.succeed(ConfigProvider)(provider)` unless the argument is an
// Effect (effect/ConfigProvider.ts); a `ConfigProvider.fromUnknown(...)` argument is a provider value.
const isConfigProviderValueLayer = (call: CallExpression, imports: EffectVitestImports): boolean => {
  const provider = call.getArguments()[0];
  return (
    isProvenanceCall(call, imports, CONFIG_PROVIDER_MODULES, "ConfigProvider", ["layer"]) &&
    call.getArguments().length === 1 &&
    Node.isCallExpression(provider) &&
    isProvenanceCall(provider, imports, CONFIG_PROVIDER_MODULES, "ConfigProvider", ["fromUnknown"])
  );
};

// `Logger.layer([Logger.make(...)])` adds logger values in a `Layer.effect`; it yields only entries
// that are Effects (effect/Logger.ts), and `Logger.make` returns a logger value.
const isLoggerValueLayer = (call: CallExpression, imports: EffectVitestImports): boolean => {
  const loggers = call.getArguments()[0];
  return (
    isProvenanceCall(call, imports, LOGGER_MODULES, "Logger", ["layer"]) &&
    Node.isArrayLiteralExpression(loggers) &&
    A.every(
      loggers.getElements(),
      (logger) => Node.isCallExpression(logger) && isProvenanceCall(logger, imports, LOGGER_MODULES, "Logger", ["make"])
    )
  );
};

// Effect's own in-memory layers, whose declarations ship only as `.d.ts`: `Path.layer` is
// `Layer.succeed(Path)(posixImpl)` (effect/Path.ts), `TestClock.layer()` is `Layer.effectContext`
// over an in-memory clock and scheduler (effect/testing/TestClock.ts), `AtomRegistry.layer` is
// `layerOptions()`, a `Layer.effect` that builds an in-memory registry with a finalizer
// (effect/reactivity/AtomRegistry.ts), and `FetchHttpClient.layer` is
// `HttpClient.layerMergedContext(Effect.succeed(fetch))` (effect/http/FetchHttpClient.ts).
const isLibraryMemoryLayer = (expression: Expression, imports: EffectVitestImports): boolean =>
  Node.isCallExpression(expression)
    ? isProvenanceCall(expression, imports, TEST_CLOCK_MODULES, "TestClock", ["layer"]) ||
      isProvenanceCall(expression, imports, ATOM_REGISTRY_MODULES, "AtomRegistry", ["layerOptions"]) ||
      isConfigProviderValueLayer(expression, imports) ||
      isLoggerValueLayer(expression, imports)
    : isProvenanceExpression(expression, imports, ["effect", "effect/Path"], "Path", ["layer"]) ||
      isProvenanceExpression(expression, imports, ATOM_REGISTRY_MODULES, "AtomRegistry", ["layer"]) ||
      isProvenanceExpression(expression, imports, FETCH_HTTP_CLIENT_MODULES, "FetchHttpClient", ["layer"]);

// One syntactic case of a judge: the call shapes it matches and how it judges them.
type LayerCallRule = {
  readonly matches: (call: CallExpression, imports: EffectVitestImports) => boolean;
  readonly judge: (call: CallExpression, env: LayerEnv, analysis: LayerAnalysis, depth: number) => boolean;
};
type LayerReferenceRule = (
  reference: Expression,
  imports: EffectVitestImports,
  env: LayerEnv,
  analysis: LayerAnalysis,
  depth: number
) => boolean;
type LayerJudgeRules = { readonly reference: LayerReferenceRule; readonly calls: ReadonlyArray<LayerCallRule> };

// A judge tries its own rules, then follows the expression to a value or a factory's returns. The rules
// are read lazily because the three judges refer to one another.
const makeLayerJudge = (rules: () => LayerJudgeRules): LayerJudge => {
  const judge: LayerJudge = (expression, env, analysis, depth) => {
    if (depth > LAYER_ANALYSIS_DEPTH) return false;
    const value = stripLayerExpression(expression);
    const imports = analysis.importsOf(value.getSourceFile());
    const { reference, calls } = rules();
    if (!Node.isCallExpression(value))
      return reference(value, imports, env, analysis, depth) || followLayerValue(value, env, analysis, depth, judge);
    return O.match(
      A.findFirst(calls, ({ matches }) => matches(value, imports)),
      {
        onNone: () => followLayerValue(value, env, analysis, depth, judge),
        onSome: (rule) => rule.judge(value, env, analysis, depth),
      }
    );
  };
  return judge;
};

const memberCall =
  (modules: ReadonlyArray<string>, namespace: string, members: ReadonlyArray<string>) =>
  (call: CallExpression, imports: EffectVitestImports): boolean =>
    isProvenanceCall(call, imports, modules, namespace, members);

const holds = (): boolean => true;

const expressionArgument = (call: CallExpression, index: number): O.Option<Expression> =>
  O.filter(O.fromUndefinedOr(call.getArguments()[index]), Node.isExpression);

const judgesArgument =
  (index: number, judge: () => LayerJudge) =>
  (call: CallExpression, env: LayerEnv, analysis: LayerAnalysis, depth: number): boolean =>
    O.exists(expressionArgument(call, index), (argument) => judge()(argument, env, analysis, depth + 1));

const judgesCallback =
  (index: number, judge: () => LayerJudge) =>
  (call: CallExpression, env: LayerEnv, analysis: LayerAnalysis, depth: number): boolean =>
    callbackReturns(call.getArguments()[index], env, analysis, depth, judge());

// `f(self, continuation)`: a hermetic `self`, then a continuation whose returns are hermetic.
const sequencedEffect = (call: CallExpression, env: LayerEnv, analysis: LayerAnalysis, depth: number): boolean =>
  call.getArguments().length === 2 &&
  judgesArgument(0, () => isHermeticEffect)(call, env, analysis, depth) &&
  judgesCallback(1, () => isHermeticEffect)(call, env, analysis, depth);

const withStageImports = (
  stage: MorphNode,
  analysis: LayerAnalysis,
  judge: (stage: Expression, imports: EffectVitestImports) => boolean
): boolean => Node.isExpression(stage) && judge(stage, analysis.importsOf(stage.getSourceFile()));

const pipedThrough = (
  call: CallExpression,
  env: LayerEnv,
  analysis: LayerAnalysis,
  depth: number,
  receiver: LayerJudge,
  stage: (stage: MorphNode, env: LayerEnv, analysis: LayerAnalysis, depth: number) => boolean
): boolean =>
  receiver(pipeReceiver(call), env, analysis, depth + 1) &&
  A.every(call.getArguments(), (candidate) => stage(candidate, env, analysis, depth));

const isLayerOperandFree = (operand: MorphNode, env: LayerEnv, analysis: LayerAnalysis, depth: number): boolean =>
  Node.isArrayLiteralExpression(operand)
    ? A.every(operand.getElements(), (element) => isLayerFree(element, env, analysis, depth + 1))
    : Node.isExpression(operand) && isLayerFree(operand, env, analysis, depth + 1);

const isFreeLayerStage = (stage: MorphNode, env: LayerEnv, analysis: LayerAnalysis, depth: number): boolean =>
  withStageImports(stage, analysis, (expression, imports) =>
    Node.isCallExpression(expression)
      ? expression.getArguments().length === 1 &&
        isProvenanceCall(expression, imports, LAYER_MODULES, "Layer", ["provide", "provideMerge", "merge"]) &&
        A.every(expression.getArguments(), (operand) => isLayerOperandFree(operand, env, analysis, depth))
      : isProvenanceExpression(expression, imports, LAYER_MODULES, "Layer", ["fresh"])
  );

const isPipeCall = (call: CallExpression): boolean => {
  const callee = call.getExpression();
  return Node.isPropertyAccessExpression(callee) && callee.getName() === "pipe";
};

const pipeReceiver = (call: CallExpression): Expression => {
  const callee = call.getExpression();
  return Node.isPropertyAccessExpression(callee) ? callee.getExpression() : callee;
};

// The effect argument of `Layer.effect(tag, effect)`, `Layer.effect(tag)(effect)` or
// `Layer.effectContext(effect)`: the last argument, once the call has all of its operands.
const layerEffectArgument = (call: CallExpression, required: number): O.Option<Expression> =>
  Node.isCallExpression(call.getExpression()) || call.getArguments().length >= required
    ? O.filter(A.last(call.getArguments()), Node.isExpression)
    : O.none();

const hermeticLayerEffect =
  (required: number) =>
  (call: CallExpression, env: LayerEnv, analysis: LayerAnalysis, depth: number): boolean =>
    O.exists(layerEffectArgument(call, required), (effect) => isHermeticEffect(effect, env, analysis, depth + 1));

const TOOLKIT_MODULES = ["effect/ai", "effect/ai/Toolkit"];

const isToolkitLayerCall = (call: CallExpression): boolean => {
  const callee = call.getExpression();
  return Node.isPropertyAccessExpression(callee) && callee.getName() === "toLayer" && call.getArguments().length === 1;
};

// `toolkit.toLayer(build)` is `Layer.effectContext(toolkit.toHandlers(build))`, which reads the context and
// yields `build` when it is an Effect (effect/ai/Toolkit.ts). It is free when the receiver resolves to
// `Toolkit.make(...)`/`Toolkit.merge(...)` and `build` is a handler record or a hermetic effect.
const isToolkitLayer = (call: CallExpression, env: LayerEnv, analysis: LayerAnalysis, depth: number): boolean => {
  const toolkit = O.exists(
    resolveLayerCallee(pipeReceiver(call), env, analysis, depth + 1),
    (entity) =>
      entity._tag === "Value" &&
      Node.isCallExpression(entity.expression) &&
      isProvenanceCall(
        entity.expression,
        analysis.importsOf(entity.expression.getSourceFile()),
        TOOLKIT_MODULES,
        "Toolkit",
        ["make", "merge"]
      )
  );
  return (
    toolkit &&
    O.exists(
      expressionArgument(call, 0),
      (build) =>
        Node.isObjectLiteralExpression(stripLayerExpression(build)) || isHermeticEffect(build, env, analysis, depth + 1)
    )
  );
};

const isLayerFree: LayerJudge = makeLayerJudge(() => LAYER_FREE_RULES);

const LAYER_FREE_RULES: LayerJudgeRules = {
  reference: (reference, imports) =>
    isLibraryMemoryLayer(reference, imports) ||
    isPlatformServiceLayer(reference, imports) ||
    isProvenanceExpression(reference, imports, LAYER_MODULES, "Layer", ["empty"]),
  calls: [
    { matches: isLibraryMemoryLayer, judge: holds },
    { matches: memberCall(LAYER_MODULES, "Layer", STUB_LAYER_MEMBERS), judge: holds },
    { matches: memberCall(LAYER_MODULES, "Layer", ["effect", "scoped"]), judge: hermeticLayerEffect(2) },
    { matches: memberCall(LAYER_MODULES, "Layer", ["effectContext", "effectDiscard"]), judge: hermeticLayerEffect(1) },
    { matches: memberCall(LAYER_MODULES, "Layer", ["suspend"]), judge: judgesCallback(0, () => isLayerFree) },
    { matches: memberCall(LAYER_MODULES, "Layer", ["unwrap"]), judge: judgesArgument(0, () => producesFreeLayer) },
    {
      matches: memberCall(LAYER_MODULES, "Layer", LAYER_COMPOSERS),
      judge: (call, env, analysis, depth) =>
        !Node.isCallExpression(call.getExpression()) &&
        A.isReadonlyArrayNonEmpty(call.getArguments()) &&
        A.every(call.getArguments(), (operand) => isLayerOperandFree(operand, env, analysis, depth)),
    },
    { matches: isToolkitLayerCall, judge: isToolkitLayer },
    {
      matches: isPipeCall,
      judge: (call, env, analysis, depth) => pipedThrough(call, env, analysis, depth, isLayerFree, isFreeLayerStage),
    },
  ],
};

const EFFECT_CONSTANTS = ["succeed", "sync", "fail", "die", "context", "service", "serviceOption"];
// In-memory Effect state: constructors plus the non-blocking reads and writes of a ref or deferred.
// `Deferred.await`, `Queue.take` and the like can suspend, so they are not listed.
const MEMORY_STATE = [
  { namespace: "Ref", members: ["make", "get", "set", "update", "updateAndGet", "getAndSet", "modify"] },
  { namespace: "SynchronizedRef", members: ["make"] },
  { namespace: "SubscriptionRef", members: ["make"] },
  { namespace: "TxRef", members: ["make"] },
  { namespace: "Deferred", members: ["make", "succeed", "done"] },
  { namespace: "Queue", members: ["make", "unbounded", "bounded", "sliding", "dropping"] },
  { namespace: "PubSub", members: ["unbounded", "bounded", "sliding", "dropping"] },
  { namespace: "Latch", members: ["make"] },
  { namespace: "Semaphore", members: ["make"] },
  { namespace: "Cache", members: ["make"] },
];

// Reading the current time is an in-memory clock read, not a wait.
const isClockRead = (expression: Expression, imports: EffectVitestImports): boolean =>
  isProvenanceExpression(expression, imports, ["effect", "effect/Clock"], "Clock", [
    "currentTimeMillis",
    "currentTimeNanos",
  ]) || isProvenanceExpression(expression, imports, ["effect", "effect/DateTime"], "DateTime", ["now", "nowAsDate"]);

const isMemoryStateCall = (call: CallExpression, imports: EffectVitestImports): boolean =>
  A.some(MEMORY_STATE, ({ namespace, members }) =>
    isProvenanceCall(call, imports, ["effect", `effect/${namespace}`], namespace, members)
  );

// `Effect` constants, in-memory state, and `LanguageModel.make(params)`, which reads optional services and
// returns the model (effect/ai/LanguageModel.ts).
const isHermeticConstructor = (call: CallExpression, imports: EffectVitestImports): boolean =>
  isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", EFFECT_CONSTANTS) ||
  isMemoryStateCall(call, imports) ||
  isProvenanceCall(call, imports, LANGUAGE_MODEL_MODULES, "LanguageModel", ["make"]);

// `Context.Service<...>()(...)`, `Context.Tag(...)` or `Context.Reference(...)` declares a service key.
const declaresServiceKey = (expression: MorphNode | undefined, imports: EffectVitestImports): boolean =>
  expression !== undefined &&
  A.some(
    [expression, ...expression.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)],
    (candidate) =>
      Node.isExpression(candidate) &&
      !Node.isCallExpression(candidate) &&
      isProvenanceExpression(candidate, imports, CONTEXT_MODULES, "Context", ["Service", "Tag", "Reference"])
  );

// Effect modules export their service key under the module's own name: `FileSystem.FileSystem`, with the
// module imported as `* as FileSystem from "effect/FileSystem"` or `{ FileSystem } from "effect"`.
const isModuleServiceKey = (expression: Expression, imports: EffectVitestImports): boolean => {
  if (!Node.isPropertyAccessExpression(expression)) return false;
  const base = expression.getExpression();
  const name = expression.getName();
  return (
    Node.isIdentifier(base) &&
    A.some(
      O.getOrElse(MutableHashMap.get(imports.bindingsByLocal, base.getText()), A.empty),
      (binding) =>
        (binding.imported === "*" &&
          (Str.startsWith("effect/")(binding.module) || Str.startsWith("@effect/")(binding.module)) &&
          Str.endsWith(`/${name}`)(binding.module)) ||
        (binding.module === "effect" && binding.imported === name)
    )
  );
};

const entityDeclaresServiceKey = (entity: LayerEntity, analysis: LayerAnalysis): boolean => {
  if (entity._tag === "Class")
    return A.some(entity.declaration.getHeritageClauses(), (clause) =>
      A.some(clause.getTypeNodes(), (type) =>
        declaresServiceKey(type.getExpression(), analysis.importsOf(entity.declaration.getSourceFile()))
      )
    );
  return (
    entity._tag === "Value" &&
    Node.isCallExpression(entity.expression) &&
    declaresServiceKey(entity.expression.getExpression(), analysis.importsOf(entity.expression.getSourceFile()))
  );
};

const readsServiceKey: LayerReferenceRule = (reference, imports, env, analysis, depth) =>
  isModuleServiceKey(reference, imports) ||
  O.exists(resolveLayerReference(reference, env, analysis, depth + 1), (entity) =>
    entityDeclaresServiceKey(entity, analysis)
  );

const ownYields = (generator: LayerFunction): ReadonlyArray<YieldExpression> =>
  A.filter(
    generator.getDescendantsOfKind(SyntaxKind.YieldExpression),
    (expression) => expression.getFirstAncestor(isFunctionBoundary) === generator
  );

const generatorCallback = (call: CallExpression): O.Option<LayerFunction> =>
  O.flatMap(A.last(call.getArguments()), (argument) =>
    Node.isExpression(argument) && isLayerFunctionNode(stripLayerExpression(argument))
      ? O.some(stripLayerExpression(argument) as LayerFunction)
      : O.none()
  );

const isHermeticGenerator = (generator: LayerFunction, env: LayerEnv, analysis: LayerAnalysis, depth: number) =>
  A.every(ownYields(generator), (expression) =>
    O.exists(
      O.fromUndefinedOr(expression.getExpression()),
      (operand) => expression.getAsteriskToken() !== undefined && isHermeticEffect(operand, env, analysis, depth + 1)
    )
  );

const hermeticGen = (call: CallExpression, env: LayerEnv, analysis: LayerAnalysis, depth: number): boolean =>
  O.exists(generatorCallback(call), (generator) => isHermeticGenerator(generator, env, analysis, depth));

const isHermeticStage = (stage: MorphNode, env: LayerEnv, analysis: LayerAnalysis, depth: number): boolean =>
  withStageImports(stage, analysis, (expression, imports) => {
    if (!Node.isCallExpression(expression))
      return isProvenanceExpression(expression, imports, EFFECT_MODULES, "Effect", ["asVoid", "orDie"]);
    return (
      isProvenanceCall(expression, imports, EFFECT_MODULES, "Effect", ["map", "as", "withSpan"]) ||
      (isProvenanceCall(expression, imports, EFFECT_MODULES, "Effect", ["flatMap", "andThen", "tap"]) &&
        judgesCallback(0, () => isHermeticEffect)(expression, env, analysis, depth))
    );
  });

// A hermetic acquisition reads services and allocates in-memory Effect state; it has no I/O,
// process, network, clock wait or unresolved effect. `Effect.try`/`tryPromise`/`promise` are not
// listed: their thunks are the external work (a model load, a socket) a hook budget should bound.
const isHermeticEffect: LayerJudge = makeLayerJudge(() => HERMETIC_EFFECT_RULES);

const HERMETIC_EFFECT_RULES: LayerJudgeRules = {
  reference: (reference, imports, env, analysis, depth) =>
    isProvenanceExpression(reference, imports, EFFECT_MODULES, "Effect", ["void", "scope"]) ||
    isClockRead(reference, imports) ||
    readsServiceKey(reference, imports, env, analysis, depth),
  calls: [
    { matches: isHermeticConstructor, judge: holds },
    { matches: memberCall(EFFECT_MODULES, "Effect", ["gen"]), judge: hermeticGen },
    {
      matches: memberCall(EFFECT_MODULES, "Effect", ["map", "as", "asVoid", "orDie"]),
      judge: judgesArgument(0, () => isHermeticEffect),
    },
    {
      matches: memberCall(EFFECT_MODULES, "Effect", ["flatMap", "andThen", "tap", "acquireRelease"]),
      judge: sequencedEffect,
    },
    {
      matches: memberCall(EFFECT_MODULES, "Effect", ["addFinalizer"]),
      judge: judgesCallback(0, () => isHermeticEffect),
    },
    {
      matches: memberCall(["effect", "effect/Scope"], "Scope", ["addFinalizer"]),
      judge: (call, env, analysis, depth) =>
        call.getArguments().length === 2 && judgesArgument(1, () => isHermeticEffect)(call, env, analysis, depth),
    },
    {
      matches: isPipeCall,
      judge: (call, env, analysis, depth) =>
        pipedThrough(call, env, analysis, depth, isHermeticEffect, isHermeticStage),
    },
  ],
};

// The effect handed to `Layer.unwrap` must be hermetic and yield an acquisition-free layer.
const producesFreeLayer: LayerJudge = makeLayerJudge(() => FREE_LAYER_EFFECT_RULES);

const FREE_LAYER_EFFECT_RULES: LayerJudgeRules = {
  reference: () => false,
  calls: [
    { matches: memberCall(EFFECT_MODULES, "Effect", ["succeed"]), judge: judgesArgument(0, () => isLayerFree) },
    { matches: memberCall(EFFECT_MODULES, "Effect", ["sync"]), judge: judgesCallback(0, () => isLayerFree) },
    {
      matches: memberCall(EFFECT_MODULES, "Effect", ["map"]),
      judge: (call, env, analysis, depth) =>
        call.getArguments().length === 2 &&
        judgesArgument(0, () => isHermeticEffect)(call, env, analysis, depth) &&
        judgesCallback(1, () => isLayerFree)(call, env, analysis, depth),
    },
    {
      matches: memberCall(EFFECT_MODULES, "Effect", ["gen"]),
      judge: (call, env, analysis, depth) =>
        hermeticGen(call, env, analysis, depth) &&
        O.exists(generatorCallback(call), (generator) =>
          judgeFunctionReturns(generator, [], env, env, isLayerFree, analysis, depth)
        ),
    },
  ],
};

const isAcquisitionFreeLayer = (layer: Expression, analysis: LayerAnalysis): boolean =>
  isLayerFree(layer, [], analysis, 0);

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

const TEMP_ROOT_CONSTRUCTORS = ["makeTempDirectory", "makeTempDirectoryScoped"];

const isEffectAcquisition = (call: CallExpression, imports: EffectVitestImports): boolean =>
  isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["acquireRelease", "acquireUseRelease"]);

// `<fs>.makeTempDirectory(options?)`: options only say where and how to name the root.
const isTempRootCall = (node: MorphNode | undefined): boolean => {
  if (!Node.isCallExpression(node)) return false;
  const callee = node.getExpression();
  return (
    Node.isPropertyAccessExpression(callee) &&
    Node.isIdentifier(callee.getExpression()) &&
    A.contains(TEMP_ROOT_CONSTRUCTORS, callee.getName())
  );
};

const isFileSystemTag = (node: MorphNode | undefined, imports: EffectVitestImports): boolean =>
  Node.isExpression(node) &&
  isProvenanceExpression(node, imports, ["effect", "effect/FileSystem"], "FileSystem", ["FileSystem"]);

const yieldedExpression = (node: MorphNode | undefined): MorphNode | undefined =>
  Node.isYieldExpression(node) && node.getAsteriskToken() !== undefined ? node.getExpression() : undefined;

// `const fs = yield* FileSystem.FileSystem` only reads the service.
const isFileSystemBinding = (statement: MorphNode, imports: EffectVitestImports): boolean =>
  Node.isVariableStatement(statement) &&
  A.every(statement.getDeclarations(), (declaration) => isFileSystemService(declaration, imports));

// `(fs) => fs.makeTempDirectory()`, or a block whose only statement returns that call.
const returnsTempRoot = (body: MorphNode | undefined): boolean => {
  if (!Node.isArrowFunction(body) && !Node.isFunctionExpression(body)) return false;
  const inner = body.getBody();
  if (!Node.isBlock(inner)) return isTempRootCall(inner);
  const statements = inner.getStatements();
  const only = statements[0];
  return statements.length === 1 && Node.isReturnStatement(only) && isTempRootCall(only.getExpression());
};

// `Effect.gen(function* () { const fs = yield* FileSystem.FileSystem; return yield* fs.makeTempDirectory(); })`.
const isTempRootGenerator = (call: CallExpression, imports: EffectVitestImports): boolean => {
  const body = call.getArguments()[0];
  if (call.getArguments().length !== 1 || !Node.isFunctionExpression(body)) return false;
  const statements = body.getStatements();
  const last = A.last(statements);
  return (
    O.exists(
      last,
      (statement) => Node.isReturnStatement(statement) && isTempRootCall(yieldedExpression(statement.getExpression()))
    ) && A.every(A.dropRight(statements, 1), (statement) => isFileSystemBinding(statement, imports))
  );
};

// The acquire IS the temp-root call, optionally behind FileSystem access. Any combinator that adds
// work (zipLeft, tap, andThen, zip, all, or a flatMap into other work) is not a fresh-root acquire.
const isTempRootAcquire = (acquire: MorphNode, imports: EffectVitestImports): boolean => {
  if (isTempRootCall(acquire)) return true;
  if (!Node.isCallExpression(acquire)) return false;
  if (isProvenanceCall(acquire, imports, EFFECT_MODULES, "Effect", ["gen"]))
    return isTempRootGenerator(acquire, imports);
  const [service, continuation, ...rest] = acquire.getArguments();
  return (
    isProvenanceCall(acquire, imports, EFFECT_MODULES, "Effect", ["flatMap"]) &&
    A.isReadonlyArrayEmpty(rest) &&
    isFileSystemTag(service, imports) &&
    returnsTempRoot(continuation)
  );
};

// `process.chdir(...)`, or an assignment or `delete` whose target is rooted at the global `process`.
const PROCESS_MODULES = ["node:process", "process"];

const isGlobalProcess = (node: MorphNode, imports: EffectVitestImports): boolean => {
  if (!Node.isIdentifier(node) || node.getText() !== "process") return false;
  const binding = imports.resolveBinding(node);
  return (
    O.isNone(binding) ||
    O.exists(
      binding,
      (declaration) =>
        Node.isImportDeclaration(declaration) && A.contains(PROCESS_MODULES, declaration.getModuleSpecifierValue())
    )
  );
};

const accessRoot = (node: MorphNode): MorphNode =>
  Node.isPropertyAccessExpression(node) || Node.isElementAccessExpression(node)
    ? accessRoot(node.getExpression())
    : node;

const isProcessAccess = (node: MorphNode, imports: EffectVitestImports): boolean =>
  (Node.isPropertyAccessExpression(node) || Node.isElementAccessExpression(node)) &&
  isGlobalProcess(accessRoot(node), imports);

const ASSIGNMENT_OPERATORS = HashSet.fromIterable([
  SyntaxKind.EqualsToken,
  SyntaxKind.PlusEqualsToken,
  SyntaxKind.QuestionQuestionEqualsToken,
  SyntaxKind.BarBarEqualsToken,
  SyntaxKind.AmpersandAmpersandEqualsToken,
]);

const mutatesProcessDirectly = (region: MorphNode, imports: EffectVitestImports): boolean =>
  A.some(region.getDescendantsOfKind(SyntaxKind.CallExpression), (call) => {
    const callee = call.getExpression();
    return (
      Node.isPropertyAccessExpression(callee) &&
      callee.getName() === "chdir" &&
      isGlobalProcess(callee.getExpression(), imports)
    );
  }) ||
  A.some(
    region.getDescendantsOfKind(SyntaxKind.BinaryExpression),
    (binary) =>
      HashSet.has(ASSIGNMENT_OPERATORS, binary.getOperatorToken().getKind()) &&
      isProcessAccess(binary.getLeft(), imports)
  ) ||
  A.some(region.getDescendantsOfKind(SyntaxKind.DeleteExpression), (deletion) =>
    isProcessAccess(deletion.getExpression(), imports)
  );

// Helpers are reached by name: a called identifier, or an identifier passed as an argument (`Effect.sync(restore)`).
const helperReferences = (region: MorphNode): ReadonlyArray<MorphNode> =>
  A.flatMap([region, ...region.getDescendantsOfKind(SyntaxKind.CallExpression)], (node) =>
    Node.isCallExpression(node)
      ? A.filter([node.getExpression(), ...node.getArguments()], Node.isIdentifier)
      : A.filter([node], Node.isIdentifier)
  );

// Follows same-file helpers called by name, because they run inside the wrapper's use or release.
const mutatesProcessState = (region: MorphNode, imports: EffectVitestImports): boolean => {
  const visited = A.empty<MorphNode>();
  const visit = (current: MorphNode): boolean =>
    mutatesProcessDirectly(current, imports) ||
    A.some(helperReferences(current), (reference) =>
      O.exists(Node.isIdentifier(reference) ? imports.resolveBinding(reference) : O.none(), (binding) => {
        // Identity, not `Equal`: structural equality over ts-morph nodes walks the whole tree.
        if (A.some(visited, (seen) => seen === binding)) return false;
        visited.push(binding);
        return O.exists(helperBody(binding, imports), visit);
      })
    );
  return visit(region);
};

const isEffectFunctionConstructor = (call: CallExpression, imports: EffectVitestImports): boolean =>
  isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["fn", "fnUntraced"]);

// `Effect.fnUntraced(function* (path) {...})` and `Effect.fn("name")(function* (path) {...})` release through their body.
const releaseFunction = (release: MorphNode, imports: EffectVitestImports): O.Option<MorphNode> => {
  if (!Node.isCallExpression(release)) return O.some(release);
  const callee = release.getExpression();
  const constructed =
    isEffectFunctionConstructor(release, imports) ||
    (Node.isCallExpression(callee) && isEffectFunctionConstructor(callee, imports));
  return constructed ? A.head(release.getArguments()) : O.none();
};

// The release must remove the exact path its acquire produced (its first parameter).
const removesAcquiredPath = (candidate: MorphNode, imports: EffectVitestImports): boolean => {
  const release = O.getOrUndefined(releaseFunction(candidate, imports));
  if (!Node.isArrowFunction(release) && !Node.isFunctionExpression(release)) return false;
  const parameter = release.getParameters()[0];
  if (parameter === undefined || !Node.isIdentifier(parameter.getNameNode())) return false;
  return A.some(release.getDescendantsOfKind(SyntaxKind.CallExpression), (call) => {
    const callee = call.getExpression();
    const target = call.getArguments()[0];
    return (
      Node.isPropertyAccessExpression(callee) &&
      callee.getName() === "remove" &&
      Node.isIdentifier(target) &&
      O.exists(imports.resolveBinding(target), (binding) => binding === parameter)
    );
  });
};

// A fresh temp root per call isolates each case on purpose; `it.layer` sharing would undo that (#1855 FP-2).
const isFreshTempRootAcquisition = (call: CallExpression, imports: EffectVitestImports): boolean => {
  if (!isEffectAcquisition(call, imports)) return false;
  const releaseIndex = isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["acquireUseRelease"]) ? 2 : 1;
  const args = call.getArguments();
  const acquire = args[0];
  const release = args[releaseIndex];
  return (
    args.length === releaseIndex + 1 &&
    acquire !== undefined &&
    release !== undefined &&
    isTempRootAcquire(acquire, imports) &&
    removesAcquiredPath(release, imports)
  );
};

const functionHasResourceWhere = (
  definition: EffectVitestFunctionNode,
  imports: EffectVitestImports,
  countsAcquisition: (call: CallExpression) => boolean
): boolean =>
  A.some(
    callbackCalls(definition),
    (call) =>
      isProvenanceCall(call, imports, LAYER_MODULES, "Layer", ["scoped", "effect", "unwrap", "launch"]) ||
      (isEffectAcquisition(call, imports) && countsAcquisition(call))
  );

const functionHasResource = (definition: EffectVitestFunctionNode, imports: EffectVitestImports): boolean =>
  functionHasResourceWhere(definition, imports, constTrue);

// `L.unwrap(...)`, or a Layer value piped only through data-last Layer combinators.
const isLayerValued = (expression: MorphNode | undefined, imports: EffectVitestImports): boolean => {
  if (!Node.isCallExpression(expression)) return false;
  if (isLayerValue(expression, imports)) return true;
  const callee = expression.getExpression();
  return (
    Node.isPropertyAccessExpression(callee) &&
    callee.getName() === "pipe" &&
    isLayerPipe(expression, imports) &&
    isLayerValued(callee.getExpression(), imports)
  );
};

// A layer factory returns its Layer to the caller's `it.layer`, which owns the build and its scope, so it is
// the shape EV003 recommends, not a wrapper around it (#1855 wave 5). Every return must be a Layer value.
const isLayerFactory = (definition: EffectVitestFunctionNode, imports: EffectVitestImports): boolean => {
  const body = definition.getBody();
  if (body === undefined) return false;
  if (!Node.isBlock(body)) return isLayerValued(body, imports);
  const returns = A.filter(
    body.getDescendantsOfKind(SyntaxKind.ReturnStatement),
    (statement) => statement.getFirstAncestor(isFunctionBoundary) === definition
  );
  return (
    A.isReadonlyArrayNonEmpty(returns) &&
    A.every(returns, (statement) => isLayerValued(statement.getExpression(), imports))
  );
};

// EV003 asks for `it.layer` sharing only when a wrapper holds a resource other than a fresh temp root.
// A wrapper that changes process state anywhere in its body (use, release, pipe stages, or a
// same-file helper it reaches) stays under review even when its only acquisition is a fresh temp root.
const functionHasShareableResource = (definition: EffectVitestFunctionNode, imports: EffectVitestImports): boolean =>
  !isLayerFactory(definition, imports) &&
  (functionHasResourceWhere(definition, imports, (call) => !isFreshTempRootAcquisition(call, imports)) ||
    (functionHasResource(definition, imports) && mutatesProcessState(definition, imports)));

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

// Only an argument forwarded to Layer.build is a caller-supplied layer.
// Fixed-layer fixtures are still reviewed at their resource definition (EV003).
const callerProvidedLayer = (
  call: CallExpression,
  definition: EffectVitestFunctionNode,
  imports: EffectVitestImports
): O.Option<Expression> => {
  const parameters = definition.getParameters();
  for (const build of callbackCalls(definition)) {
    if (!isProvenanceCall(build, imports, LAYER_MODULES, "Layer", ["build"])) continue;
    const argument = build.getArguments()[0];
    if (!Node.isIdentifier(argument)) continue;
    const index = A.findFirstIndex(parameters, (parameter) =>
      O.exists(imports.resolveBinding(argument), (binding) => binding === parameter)
    );
    if (O.isSome(index)) return O.filter(O.fromUndefinedOr(call.getArguments()[index.value]), Node.isExpression);
  }
  return O.none();
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
  isExpectCall(call, imports) ||
  isBooleanAssertion(call, imports) ||
  O.exists(
    terminalPipeStage(call, imports),
    (stage) =>
      Node.isExpression(stage) &&
      isProvenanceExpression(stage, imports, ["@effect/vitest/utils"], "utils", ["assertTrue", "assertFalse"])
  );
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
        A.some([candidate.getExpression(), ...candidate.getArguments()], (argument) =>
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
// Only these rc.115 public operations have a fixed tagged/Boolean result after full application.
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

const FORK_MEMBERS = ["forkChild", "forkScoped", "forkDetach"];

// `Effect.forkChild(x)`, or a `.pipe` stage `Effect.forkChild` / `Effect.forkChild({ ... })`.
const forkCall = (call: CallExpression, imports: EffectVitestImports): boolean => {
  if (isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", FORK_MEMBERS)) return true;
  const callee = call.getExpression();
  return (
    Node.isPropertyAccessExpression(callee) &&
    callee.getName() === "pipe" &&
    A.some(call.getArguments(), (argument) =>
      Node.isCallExpression(argument)
        ? isProvenanceCall(argument, imports, EFFECT_MODULES, "Effect", FORK_MEMBERS)
        : Node.isExpression(argument) &&
          isProvenanceExpression(argument, imports, EFFECT_MODULES, "Effect", FORK_MEMBERS)
    )
  );
};

// Whether any identifier under `node` resolves to one of `bindings`.
// Identity, not `Equal`: structural equality over ts-morph nodes walks the whole tree.
const readsBinding = (node: MorphNode, bindings: ReadonlyArray<MorphNode>, imports: EffectVitestImports): boolean =>
  A.some(node.getDescendantsOfKind(SyntaxKind.Identifier), (identifier) =>
    O.exists(imports.resolveBinding(identifier), (binding) => A.some(bindings, (carrier) => carrier === binding))
  );

const newCarriers = (
  declarations: ReadonlyArray<VariableDeclaration>,
  reached: ReadonlyArray<MorphNode>,
  imports: EffectVitestImports
): ReadonlyArray<MorphNode> =>
  A.filter(declarations, (declaration) => {
    const initializer = declaration.getInitializer();
    return (
      initializer !== undefined &&
      !A.some(reached, (carrier) => carrier === declaration) &&
      readsBinding(initializer, reached, imports)
    );
  });

// Test-body declarations that carry the wait: the one whose initializer holds it, then every
// test-body declaration whose initializer reads one already reached (a fake service handed to a subject).
const waitCarriers = (
  wait: CallExpression,
  callback: EffectVitestFunctionNode,
  imports: EffectVitestImports
): ReadonlyArray<MorphNode> => {
  const holder = wait.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (holder === undefined || !scopeContains(callback, holder)) return [];
  const declarations = callback.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  let reached: ReadonlyArray<MorphNode> = [holder];
  let added = newCarriers(declarations, reached, imports);
  while (A.isReadonlyArrayNonEmpty(added)) {
    reached = [...reached, ...added];
    added = newCarriers(declarations, reached, imports);
  }
  return reached;
};

const readsOrIs = (node: MorphNode, bindings: ReadonlyArray<MorphNode>, imports: EffectVitestImports): boolean =>
  (Node.isIdentifier(node) &&
    O.exists(imports.resolveBinding(node), (binding) => A.some(bindings, (carrier) => carrier === binding))) ||
  readsBinding(node, bindings, imports);

const encloses = (outer: MorphNode, inner: MorphNode): boolean =>
  outer.getStart() <= inner.getStart() && inner.getEnd() <= outer.getEnd();

// The carriers that build the forked value: those the fork reads, then every carrier their initializers read.
const forkFeeders = (
  fork: CallExpression,
  carriers: ReadonlyArray<VariableDeclaration>,
  imports: EffectVitestImports
): ReadonlyArray<VariableDeclaration> => {
  let fed = A.filter(carriers, (carrier) => readsOrIs(fork, [carrier], imports));
  let added = fed;
  while (A.isReadonlyArrayNonEmpty(added)) {
    const known = fed;
    added = A.filter(
      carriers,
      (carrier) =>
        !A.some(known, (feeder) => feeder === carrier) &&
        A.some(known, (feeder) =>
          O.exists(O.fromUndefinedOr(feeder.getInitializer()), (init) => readsOrIs(init, [carrier], imports))
        )
    );
    fed = [...known, ...added];
  }
  return fed;
};

// A carrier the test body also yields itself runs its wait on the test fiber, so the fork does not hold it:
// a `yield*` outside the fork and outside the feeders' own initializers that reads a carrier declared before
// the fork (the fiber handle and later join results are not carriers of the wait).
const directlyAwaited = (
  fork: CallExpression,
  carriers: ReadonlyArray<VariableDeclaration>,
  callback: EffectVitestFunctionNode,
  imports: EffectVitestImports
): boolean => {
  const before = A.filter(carriers, (carrier) => carrier.getStart() < fork.getStart() && !encloses(carrier, fork));
  const feeders = forkFeeders(fork, before, imports);
  return A.some(
    callback.getDescendantsOfKind(SyntaxKind.YieldExpression),
    (yielded) =>
      yielded.getAsteriskToken() !== undefined &&
      !encloses(yielded, fork) &&
      !A.some(feeders, (feeder) =>
        O.exists(O.fromUndefinedOr(feeder.getInitializer()), (init) => encloses(init, yielded))
      ) &&
      O.exists(O.fromUndefinedOr(yielded.getExpression()), (operand) => readsOrIs(operand, before, imports))
  );
};

// The fork that runs the wait: a syntactic fork ancestor, or a fork in the same body whose
// arguments or receiver read a test-body value carrying the wait, when the body does not also
// yield that value directly.
const forkOfWait = (
  wait: CallExpression,
  callback: EffectVitestFunctionNode,
  imports: EffectVitestImports
): O.Option<CallExpression> => {
  const ancestor = A.findFirst(
    wait.getAncestors(),
    (node): node is CallExpression =>
      Node.isCallExpression(node) &&
      scopeContains(callback, node) &&
      (isProvenanceCall(node, imports, EFFECT_MODULES, "Effect", FORK_MEMBERS) ||
        pipedWaitUses(node, wait, imports, EFFECT_MODULES, "Effect", FORK_MEMBERS))
  );
  if (O.isSome(ancestor)) return ancestor;
  const carriers = waitCarriers(wait, callback, imports);
  if (A.isReadonlyArrayEmpty(carriers)) return O.none();
  const declarations = A.filter(carriers, Node.isVariableDeclaration);
  return O.filter(
    A.findFirst(callbackCalls(callback), (call) => forkCall(call, imports) && readsBinding(call, carriers, imports)),
    (fork) => !directlyAwaited(fork, declarations, callback, imports)
  );
};

// A wait is controlled when a fiber forked in the test body holds it and a later statement of the
// same body drives the TestClock or interrupts fibers, the TestClock canon (#1855 wave 5). A clock
// operation before the fork cannot drive it, and a directly awaited wait is never controlled.
const controlledWait = (
  wait: CallExpression,
  callback: EffectVitestFunctionNode,
  imports: EffectVitestImports
): boolean =>
  O.exists(forkOfWait(wait, callback, imports), (fork) =>
    A.some(
      callbackCalls(callback),
      (call) =>
        call.getStart() > fork.getEnd() &&
        (isProvenanceCall(call, imports, TEST_CLOCK_MODULES, "TestClock", ["adjust", "setTime"]) ||
          isProvenanceCall(call, imports, ["effect", "effect/Fiber"], "Fiber", ["interrupt", "interruptAll"]))
    )
  );
// Effect v4 exposes the live time reads as Effect values, so they appear as
// references rather than calls inside the live body: `Clock.currentTimeMillis`
// through a namespace, or a bare `currentTimeMillis` through a named import.
const isLiveClockReference = (imports: EffectVitestImports) => (expression: Expression) =>
  isProvenanceExpression(expression, imports, ["effect", "effect/Clock"], "Clock", [
    "currentTimeMillis",
    "currentTimeNanos",
  ]);
const isBareReference = (identifier: Identifier): boolean => {
  const parent = identifier.getParent();
  return !(Node.isPropertyAccessExpression(parent) && parent.getNameNode() === identifier);
};
const liveClockRead = (callback: EffectVitestFunctionNode, imports: EffectVitestImports): boolean =>
  A.some(callback.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression), isLiveClockReference(imports)) ||
  A.some(
    A.filter(callback.getDescendantsOfKind(SyntaxKind.Identifier), isBareReference),
    isLiveClockReference(imports)
  );
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
  ) || liveClockRead(callback, imports);
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

const servicesBundleNames = ["NodeServices", "BunServices"];
// Results of these operations are POSIX link resolution or inode metadata.
const nativeFileSystemOperations = ["chmod", "chown", "link", "readLink", "realPath", "symlink", "utimes"];
const testKitModules = ["@beep/test-utils", "@beep/test-runner"];

type HarnessFlow = { readonly harness: CallExpression; readonly subject: boolean };
// Keyed by declaration start offset: every flow walk stays within one source file.
type FlowCache = MutableHashMap.MutableHashMap<number, O.Option<ReadonlyArray<HarnessFlow>>>;

const isArgumentOf = (call: CallExpression, node: MorphNode): boolean =>
  A.some(call.getArguments(), (argument) => argument === node);

const isWorkspaceSubjectModule = (moduleName: string): boolean =>
  Str.startsWith("@beep/")(moduleName) &&
  !A.some(testKitModules, (kit) => moduleName === kit || Str.startsWith(`${kit}/`)(moduleName));

const isNamePosition = (identifier: Identifier): boolean => {
  const parent = identifier.getParent();
  return (
    (Node.isQualifiedName(parent) && parent.getRight() === identifier) ||
    (Node.isBindingElement(parent) && parent.getPropertyNameNode() === identifier) ||
    (Node.hasName(parent) && !Node.isShorthandPropertyAssignment(parent) && parent.getNameNode() === identifier)
  );
};

const bindingReferences = (
  binding: ImportDeclaration | VariableDeclaration,
  local: string,
  imports: EffectVitestImports
): ReadonlyArray<Identifier> =>
  A.filter(
    binding.getSourceFile().getDescendantsOfKind(SyntaxKind.Identifier),
    (reference) =>
      reference.getText() === local &&
      reference.getFirstAncestorByKind(SyntaxKind.ImportDeclaration) === undefined &&
      !isNamePosition(reference) &&
      O.exists(imports.resolveBinding(reference), (resolved) => resolved === binding)
  );

const memberAccess = (node: MorphNode, member: string): O.Option<MorphNode> => {
  const parent = node.getParent();
  return Node.isPropertyAccessExpression(parent) && parent.getExpression() === node && parent.getName() === member
    ? O.some(parent)
    : O.none();
};

const isBundleBinding = (imported: string, subpath: boolean): boolean =>
  imported === "*" || (subpath ? imported === "layer" : A.contains(servicesBundleNames, imported));

// Some(None) skips a non-bundle namespace member; None makes the provenance opaque.
const namespaceBundleMember = (reference: Identifier): O.Option<O.Option<MorphNode>> => {
  const member = platformReferenceMember(reference);
  if (O.exists(member, (name) => name !== "opaque" && !A.contains(servicesBundleNames, name))) return O.some(O.none());
  const parent = reference.getParent();
  return O.exists(member, (name) => A.contains(servicesBundleNames, name)) && parent !== undefined
    ? O.some(O.some(parent))
    : O.none();
};

// None means a bundle reference that is not a `layer` value; an empty array skips the reference.
const bundleReferenceLayers = (
  reference: Identifier,
  imported: string,
  namespacedBundle: boolean
): O.Option<ReadonlyArray<MorphNode>> =>
  O.flatMap(
    namespacedBundle ? namespaceBundleMember(reference) : O.some(O.some<MorphNode>(reference)),
    O.match({
      onNone: () => O.some(A.empty<MorphNode>()),
      onSome: (node) => (imported === "layer" ? O.some(A.of(node)) : O.map(memberAccess(node, "layer"), A.of)),
    })
  );

// None means a bundle reference that is not a `layer` value, so provenance stays opaque.
const servicesBundleLayers = (
  declaration: ImportDeclaration,
  imports: EffectVitestImports
): O.Option<ReadonlyArray<MorphNode>> => {
  const subpath = A.contains(platformServicesModules, declaration.getModuleSpecifierValue());
  const bundles = A.filter(
    imports.bindings,
    (candidate) => candidate.declaration === declaration && isBundleBinding(candidate.imported, subpath)
  );
  return O.map(
    O.all(
      A.flatMap(bundles, (binding) =>
        A.map(bindingReferences(declaration, binding.local, imports), (reference) =>
          bundleReferenceLayers(reference, binding.imported, binding.imported === "*" && !subpath)
        )
      )
    ),
    A.flatten
  );
};

const providesWorkspaceSubject = (target: MorphNode, imports: EffectVitestImports): boolean =>
  A.some(
    [target, ...target.getDescendantsOfKind(SyntaxKind.Identifier)],
    (node) =>
      Node.isIdentifier(node) &&
      !isNamePosition(node) &&
      O.exists(O.filter(imports.resolveBinding(node), Node.isImportDeclaration), (declaration) =>
        isWorkspaceSubjectModule(declaration.getModuleSpecifierValue())
      )
  );

const providerTarget = (
  provide: CallExpression,
  provider: MorphNode,
  imports: EffectVitestImports
): O.Option<MorphNode> => {
  const args = provide.getArguments();
  if (args.length === 2) return args[1] === provider ? O.fromUndefinedOr(args[0]) : O.none();
  const stage = provide.getParent();
  if (!Node.isCallExpression(stage) || !isArgumentOf(stage, provide)) return O.none();
  const callee = stage.getExpression();
  if (Node.isPropertyAccessExpression(callee) && callee.getName() === "pipe") return O.some(callee.getExpression());
  return isProvenanceCall(stage, imports, ["effect", "effect/Function"], "Function", ["pipe"])
    ? O.fromUndefinedOr(stage.getArguments()[0])
    : O.none();
};

const isDataLastLayerStage = (node: MorphNode, imports: EffectVitestImports): boolean =>
  Node.isCallExpression(node) &&
  node.getArguments().length === 1 &&
  isProvenanceCall(node, imports, LAYER_MODULES, "Layer", ["provide", "provideMerge", "merge"]);

// A pipe preserves the layer only when every stage is a data-last Layer combinator.
const isLayerPipe = (stage: MorphNode, imports: EffectVitestImports): boolean => {
  if (!Node.isCallExpression(stage)) return false;
  const callee = stage.getExpression();
  const stages =
    Node.isPropertyAccessExpression(callee) && callee.getName() === "pipe"
      ? stage.getArguments()
      : isProvenanceCall(stage, imports, ["effect", "effect/Function"], "Function", ["pipe"])
        ? A.drop(stage.getArguments(), 1)
        : [];
  return !A.isReadonlyArrayEmpty(stages) && A.every(stages, (candidate) => isDataLastLayerStage(candidate, imports));
};

// One step up the parent chain: climb with the subject flag, or stop with the flows found.
type FlowStep =
  | { readonly _tag: "climb"; readonly provided: boolean }
  | { readonly _tag: "done"; readonly flows: O.Option<ReadonlyArray<HarnessFlow>> };

const climb = (provided: boolean): FlowStep => ({ _tag: "climb", provided });
const done = (flows: O.Option<ReadonlyArray<HarnessFlow>>): FlowStep => ({ _tag: "done", flows });

const isPreservingLayerCall = (parent: CallExpression, imports: EffectVitestImports): boolean =>
  isDataLastLayerStage(parent, imports)
    ? O.exists(O.fromUndefinedOr(parent.getParent()), (stage) => isLayerPipe(stage, imports))
    : isProvenanceCall(parent, imports, LAYER_MODULES, "Layer", ["provide", "provideMerge", "merge", "mergeAll"]);

const suppliesSubject = (parent: CallExpression, current: MorphNode, imports: EffectVitestImports): boolean =>
  isProvenanceCall(parent, imports, LAYER_MODULES, "Layer", ["provide", "provideMerge"]) &&
  O.exists(providerTarget(parent, current, imports), (target) => providesWorkspaceSubject(target, imports));

const callStep = (
  parent: CallExpression,
  current: MorphNode,
  imports: EffectVitestImports,
  provided: boolean
): FlowStep => {
  if (!isArgumentOf(parent, current)) return done(O.none());
  if (isHarnessMethodCall(parent, imports, "layer"))
    return done(parent.getArguments()[0] === current ? O.some([{ harness: parent, subject: provided }]) : O.none());
  if (isDataLastLayerStage(current, imports) && isLayerPipe(parent, imports)) return climb(provided);
  if (!isPreservingLayerCall(parent, imports)) return done(O.none());
  return climb(provided || suppliesSubject(parent, current, imports));
};

const isFollowableBinding = (
  declaration: VariableDeclaration,
  current: MorphNode,
  seen: ReadonlyArray<VariableDeclaration>
): boolean =>
  declaration.getInitializer() === current &&
  declaration.getVariableStatement()?.getDeclarationKind() === "const" &&
  Node.isIdentifier(declaration.getNameNode()) &&
  !A.some(seen, (prior) => prior === declaration);

const declarationFlows = (
  declaration: VariableDeclaration,
  current: MorphNode,
  imports: EffectVitestImports,
  seen: ReadonlyArray<VariableDeclaration>,
  provided: boolean,
  visited: FlowCache
): O.Option<ReadonlyArray<HarnessFlow>> => {
  if (!isFollowableBinding(declaration, current, seen)) return O.none();
  const reached = O.getOrElse(MutableHashMap.get(visited, declaration.getStart()), () =>
    bindingFlows(declaration, imports, [...seen, declaration], visited)
  );
  return O.map(
    reached,
    A.map((flow) => ({ ...flow, subject: flow.subject || provided }))
  );
};

const parentStep = (
  parent: MorphNode,
  current: MorphNode,
  imports: EffectVitestImports,
  seen: ReadonlyArray<VariableDeclaration>,
  provided: boolean,
  visited: FlowCache
): FlowStep => {
  if (Node.isParenthesizedExpression(parent)) return climb(provided);
  if (Node.isCallExpression(parent)) return callStep(parent, current, imports, provided);
  if (Node.isVariableDeclaration(parent))
    return done(declarationFlows(parent, current, imports, seen, provided, visited));
  return done(O.none());
};

// Follow a layer value through const bindings and Layer composition to the
// `@effect/vitest` layer harnesses it provides; any other use stays opaque.
const harnessFlows = (
  node: MorphNode,
  imports: EffectVitestImports,
  seen: ReadonlyArray<VariableDeclaration>,
  subject: boolean,
  visited: FlowCache
): O.Option<ReadonlyArray<HarnessFlow>> => {
  let provided = subject;
  let current = node;
  for (let parent = current.getParent(); parent !== undefined; current = parent, parent = parent.getParent()) {
    const step = parentStep(parent, current, imports, seen, provided, visited);
    if (step._tag === "done") return step.flows;
    provided = step.provided;
  }
  return O.none();
};

// Cached flows omit subjects supplied above the binding; callers add their own.
const bindingFlows = (
  declaration: VariableDeclaration,
  imports: EffectVitestImports,
  seen: ReadonlyArray<VariableDeclaration>,
  visited: FlowCache
): O.Option<ReadonlyArray<HarnessFlow>> => {
  const flows = A.empty<HarnessFlow>();
  let opaque = false;
  for (const reference of bindingReferences(declaration, declaration.getName(), imports)) {
    const reached = harnessFlows(reference, imports, seen, false, visited);
    if (O.isNone(reached)) {
      opaque = true;
      break;
    }
    flows.push(...reached.value);
  }
  const result = opaque || A.isReadonlyArrayEmpty(flows) ? O.none() : O.some(flows);
  MutableHashMap.set(visited, declaration.getStart(), result);
  return result;
};

const harnessCallback = (harness: CallExpression): O.Option<MorphNode> => {
  const registration = harness.getParent();
  return Node.isCallExpression(registration) && registration.getExpression() === harness
    ? O.filter(
        A.last(registration.getArguments()),
        (callback) => Node.isArrowFunction(callback) || Node.isFunctionExpression(callback)
      )
    : O.none();
};

const isFileSystemService = (declaration: VariableDeclaration, imports: EffectVitestImports): boolean => {
  const initializer = declaration.getInitializer();
  return (
    Node.isIdentifier(declaration.getNameNode()) &&
    Node.isYieldExpression(initializer) &&
    initializer.getAsteriskToken() !== undefined &&
    O.exists(O.fromUndefinedOr(initializer.getExpression()), (service) =>
      isProvenanceExpression(service, imports, ["effect", "effect/FileSystem"], "FileSystem", ["FileSystem"])
    )
  );
};

const isNativeFileSystemOperation = (
  call: CallExpression,
  services: ReadonlyArray<VariableDeclaration>,
  imports: EffectVitestImports
): boolean => {
  const callee = call.getExpression();
  if (!Node.isPropertyAccessExpression(callee) || !A.contains(nativeFileSystemOperations, callee.getName()))
    return false;
  const receiver = callee.getExpression();
  return (
    Node.isIdentifier(receiver) &&
    O.exists(imports.resolveBinding(receiver), (binding) => A.some(services, (service) => service === binding))
  );
};

const harnessCallbackKinds = HashSet.fromIterable([SyntaxKind.ArrowFunction, SyntaxKind.FunctionExpression]);

const isFunctionValue = (node: MorphNode | undefined): node is EffectVitestFunctionNode =>
  Node.isArrowFunction(node) || Node.isFunctionExpression(node);

// `Effect.fn(name)(body)`, `Effect.fn(body)` and `Effect.fnUntraced(body)` with no pipeline stages
// keep the caller's context; any extra stage could provide another FileSystem.
const effectFunctionBody = (call: CallExpression, imports: EffectVitestImports): O.Option<EffectVitestFunctionNode> => {
  const [body, ...stages] = call.getArguments();
  if (!isFunctionValue(body) || !A.isReadonlyArrayEmpty(stages)) return O.none();
  const callee = call.getExpression();
  const named = Node.isCallExpression(callee) && isProvenanceCall(callee, imports, EFFECT_MODULES, "Effect", ["fn"]);
  return named || isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["fn", "fnUntraced"])
    ? O.some(body)
    : O.none();
};

const helperBody = (binding: MorphNode, imports: EffectVitestImports): O.Option<EffectVitestFunctionNode> => {
  if (Node.isFunctionDeclaration(binding)) return O.some(binding);
  if (!Node.isVariableDeclaration(binding) || binding.getVariableStatement()?.getDeclarationKind() !== "const")
    return O.none();
  const initializer = binding.getInitializer();
  if (isFunctionValue(initializer)) return O.some(initializer);
  return Node.isCallExpression(initializer) ? effectFunctionBody(initializer, imports) : O.none();
};

const isPublicLayerProvider = (call: CallExpression, imports: EffectVitestImports): boolean =>
  isProvenanceCall(call, imports, ["@beep/test-utils", "@beep/test-utils/Layer"], "provideScopedLayer", [
    "provideScopedLayer",
  ]);

// Every effect/Effect combinator that provides or rewrites services for the effect it wraps.
const effectContextProviders = ["provide", "provideContext", "setContext", "updateContext"];
// Service-keyed providers name the one service they replace.
const effectServiceProviders = ["provideService", "provideServiceEffect", "updateService", "updateServiceScoped"];

// One classifier for any call that provides or rewrites context: the public
// `provideScopedLayer` helper plus every effect/Effect provide and update combinator.
const isContextProvider = (call: CallExpression, imports: EffectVitestImports): boolean =>
  isPublicLayerProvider(call, imports) ||
  isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", [...effectContextProviders, ...effectServiceProviders]);

// `updateServiceScoped(key, f, options?)` always leads with the key; the others take
// `(self, key, value)` data-first and `(key, value)` or `(key)` data-last.
const serviceKey = (call: CallExpression, imports: EffectVitestImports): O.Option<MorphNode> => {
  if (!isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", effectServiceProviders)) return O.none();
  const args = call.getArguments();
  const leading = isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["updateServiceScoped"]);
  return O.fromUndefinedOr(args[!leading && args.length === 3 ? 1 : 0]);
};

const importedName = (declaration: ImportDeclaration, local: string): string =>
  O.getOrElse(
    O.map(
      A.findFirst(
        declaration.getNamedImports(),
        (specifier) => (specifier.getAliasNode()?.getText() ?? specifier.getName()) === local
      ),
      (specifier) => specifier.getName()
    ),
    () => local
  );

// A key proves another service only when it is an imported tag that is not FileSystem:
// not from effect/FileSystem, not imported as FileSystem, and not a `.FileSystem` member.
const keysOtherService = (key: MorphNode, imports: EffectVitestImports): boolean => {
  const access = Node.isPropertyAccessExpression(key);
  const root = access ? key.getExpression() : key;
  if (!Node.isIdentifier(root) || (access && key.getName() === "FileSystem")) return false;
  return O.exists(
    O.filter(imports.resolveBinding(root), Node.isImportDeclaration),
    (declaration) =>
      declaration.getModuleSpecifierValue() !== "effect/FileSystem" &&
      importedName(declaration, root.getText()) !== "FileSystem"
  );
};

// A provider replaces FileSystem unless its service key provably names another service.
const replacesFileSystem = (call: CallExpression, imports: EffectVitestImports): boolean =>
  isContextProvider(call, imports) && !O.exists(serviceKey(call, imports), (key) => keysOtherService(key, imports));

// A pipe stage is a provider call, or the curried `provideService(key)(value)` form.
const isProviderStage = (stage: MorphNode, imports: EffectVitestImports): boolean => {
  if (!Node.isCallExpression(stage)) return false;
  const callee = stage.getExpression();
  return replacesFileSystem(stage, imports) || (Node.isCallExpression(callee) && replacesFileSystem(callee, imports));
};

const providesContext = (helper: EffectVitestFunctionNode, imports: EffectVitestImports): boolean =>
  A.some(callbackCalls(helper), (call) => replacesFileSystem(call, imports));

const containsNode = (outer: MorphNode, inner: MorphNode): boolean =>
  outer === inner || A.some(inner.getAncestors(), (ancestor) => ancestor === outer);

// A pipe whose input holds the call and whose later stages include a provider.
const pipesThroughProvider = (pipe: CallExpression, call: MorphNode, imports: EffectVitestImports): boolean => {
  const callee = pipe.getExpression();
  if (Node.isPropertyAccessExpression(callee) && callee.getName() === "pipe")
    return (
      containsNode(callee.getExpression(), call) &&
      A.some(pipe.getArguments(), (stage) => isProviderStage(stage, imports))
    );
  if (!isProvenanceCall(pipe, imports, ["effect", "effect/Function"], "Function", ["pipe"])) return false;
  const [input, ...stages] = pipe.getArguments();
  return input !== undefined && containsNode(input, call) && A.some(stages, (stage) => isProviderStage(stage, imports));
};

// True when a provider or update wrapper encloses this call site within its region,
// either taking it as an argument or piping it through a provider stage.
const wrappedByProvider = (call: MorphNode, region: MorphNode, imports: EffectVitestImports): boolean =>
  A.some(
    A.takeWhile(call.getAncestors(), (ancestor) => ancestor !== region),
    (ancestor) =>
      Node.isCallExpression(ancestor) &&
      ((isProviderStage(ancestor, imports) &&
        A.some(ancestor.getArguments(), (argument) => containsNode(argument, call))) ||
        pipesThroughProvider(ancestor, call, imports))
  );

const isYieldStar = (node: MorphNode | undefined): boolean =>
  Node.isYieldExpression(node) && node.getAsteriskToken() !== undefined;

// A call on an effect/Effect namespace (`Effect.map(program, f)`) keeps carrying its effect arguments.
const isEffectModuleCall = (call: CallExpression, imports: EffectVitestImports): boolean => {
  const callee = call.getExpression();
  if (!Node.isPropertyAccessExpression(callee)) return false;
  const receiver = callee.getExpression();
  return (
    Node.isIdentifier(receiver) &&
    O.exists(O.filter(imports.resolveBinding(receiver), Node.isImportDeclaration), (declaration) =>
      A.contains(EFFECT_MODULES, declaration.getModuleSpecifierValue())
    )
  );
};

// `program.pipe(...stages)` carries the receiver on when no stage is a provider.
const pipeCarrier = (access: MorphNode, node: MorphNode, imports: EffectVitestImports): O.Option<MorphNode> => {
  if (!Node.isPropertyAccessExpression(access) || access.getExpression() !== node || access.getName() !== "pipe")
    return O.none();
  const pipe = access.getParent();
  return Node.isCallExpression(pipe) &&
    pipe.getExpression() === access &&
    !A.some(pipe.getArguments(), (stage) => isProviderStage(stage, imports))
    ? O.some(pipe)
    : O.none();
};

// `Effect.map(program, f)` and similar effect/Effect calls carry their effect arguments.
const effectCallCarries = (parent: MorphNode | undefined, node: MorphNode, imports: EffectVitestImports): boolean =>
  Node.isCallExpression(parent) &&
  isArgumentOf(parent, node) &&
  isEffectModuleCall(parent, imports) &&
  !isProviderStage(parent, imports);

// The expression that carries this effect value one step further, when the step adds no provider.
const carriedBy = (node: MorphNode, imports: EffectVitestImports): O.Option<MorphNode> => {
  const parent = node.getParent();
  if (parent === undefined) return O.none();
  if (Node.isParenthesizedExpression(parent) || Node.isArrayLiteralExpression(parent)) return O.some(parent);
  return effectCallCarries(parent, node, imports) ? O.some(parent) : pipeCarrier(parent, node, imports);
};

// A function whose returned effect is run by its own caller: the region itself, whose call
// sites are checked separately, or a test registration callback run by the harness.
const returnsToRunner = (fn: MorphNode | undefined, region: MorphNode, imports: EffectVitestImports): boolean => {
  if (fn === region) return true;
  const registration = fn?.getParent();
  return (
    Node.isCallExpression(registration) &&
    O.exists(classifyHarnessCall(registration, imports), (mode) => mode !== "layer")
  );
};

type BindingCheck = {
  readonly region: MorphNode;
  readonly imports: EffectVitestImports;
  readonly seen: Array<VariableDeclaration>;
};

// Where one effect value ends up. It is safe only when it is run by `yield*`, discarded,
// returned to a runner, or bound to a `const` whose own uses are all safe.
const flowsToNativeRun = (node: MorphNode, check: BindingCheck): boolean => {
  let current = node;
  for (let next = carriedBy(current, check.imports); O.isSome(next); next = carriedBy(current, check.imports))
    current = next.value;
  const parent = current.getParent();
  if (isYieldStar(parent) || Node.isExpressionStatement(parent)) return true;
  if (Node.isReturnStatement(parent))
    return returnsToRunner(parent.getFirstAncestor(functionLike), check.region, check.imports);
  if (Node.isArrowFunction(parent) && parent.getBody() === current)
    return returnsToRunner(parent, check.region, check.imports);
  return Node.isVariableDeclaration(parent) && parent.getInitializer() === current && effectBindingSafe(parent, check);
};

const functionLike = (node: MorphNode): boolean =>
  Node.isArrowFunction(node) || Node.isFunctionExpression(node) || Node.isFunctionDeclaration(node);

// A `const` holding an unrun effect: every reference must be resolvable and flow safely,
// and none may sit under a provider. `let`, destructuring and escapes keep it opaque.
const effectBindingSafe = (declaration: VariableDeclaration, check: BindingCheck): boolean => {
  if (A.some(check.seen, (prior) => prior === declaration)) return true;
  check.seen.push(declaration);
  const name = declaration.getNameNode();
  if (!Node.isIdentifier(name) || declaration.getVariableStatement()?.getDeclarationKind() !== "const") return false;
  return A.every(
    bindingReferences(declaration, name.getText(), check.imports),
    (reference) => !wrappedByProvider(reference, check.region, check.imports) && flowsToNativeRun(reference, check)
  );
};

// A `yield*` result binding: the helper already ran in the caller's context, so only a
// reference placed under a provider can make the call site ambiguous.
const resultBindingSafe = (declaration: VariableDeclaration, check: BindingCheck): boolean => {
  const name = declaration.getNameNode();
  return (
    !Node.isIdentifier(name) ||
    !A.some(bindingReferences(declaration, name.getText(), check.imports), (reference) =>
      wrappedByProvider(reference, check.region, check.imports)
    )
  );
};

// One step from a value to its consumer: through `yield*` (the effect has then run) or a carrier.
const valueStep = (
  node: MorphNode,
  imports: EffectVitestImports
): O.Option<{ readonly next: MorphNode; readonly ran: boolean }> => {
  const parent = node.getParent();
  if (parent !== undefined && isYieldStar(parent)) return O.some({ next: parent, ran: true });
  return O.map(carriedBy(node, imports), (next) => ({ next, ran: false }));
};

// Follows the helper call's value to its binding, if any, and checks every use of it.
const boundValueSafe = (call: CallExpression, region: MorphNode, imports: EffectVitestImports): boolean => {
  let current: MorphNode = call;
  let ran = false;
  for (let step = valueStep(current, imports); O.isSome(step); step = valueStep(current, imports)) {
    current = step.value.next;
    ran = ran || step.value.ran;
  }
  const parent = current.getParent();
  const check: BindingCheck = { region, imports, seen: [] };
  if (Node.isVariableDeclaration(parent) && parent.getInitializer() === current)
    return ran ? resultBindingSafe(parent, check) : effectBindingSafe(parent, check);
  // An unrun value must reach a native run like a bound one; an unknown function argument,
  // object property, spread or assignment does not, so the helper stays unfollowed.
  return ran || flowsToNativeRun(current, check);
};

// `updateServiceScoped` rewrites the rest of its scope, so it taints every call site in the region.
const regionUpdatesScope = (calls: ReadonlyArray<CallExpression>, imports: EffectVitestImports): boolean =>
  A.some(
    calls,
    (call) =>
      isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["updateServiceScoped"]) &&
      replacesFileSystem(call, imports)
  );

// A same-file helper called by name runs in the caller's context, so its
// FileSystem reads count as the harness callback's own.
const calledHelper = (call: CallExpression, imports: EffectVitestImports): O.Option<EffectVitestFunctionNode> => {
  const callee = call.getExpression();
  return Node.isIdentifier(callee)
    ? O.filter(
        O.flatMap(imports.resolveBinding(callee), (binding) => helperBody(binding, imports)),
        (helper) => !providesContext(helper, imports)
      )
    : O.none();
};

// Records FileSystem service bindings and calls lexically inside one region.
const collectFileSystemEvidence = (
  region: MorphNode,
  imports: EffectVitestImports,
  services: Array<VariableDeclaration>,
  calls: Array<CallExpression>
): void =>
  region.forEachDescendant((node, traversal) => {
    if (Node.isVariableDeclaration(node) && isFileSystemService(node, imports)) services.push(node);
    if (Node.isCallExpression(node)) calls.push(node);
    // Only these two syntax kinds can be harness callbacks; other descendants need no provenance lookup.
    if (!HashSet.has(harnessCallbackKinds, node.getKind())) return;
    const harness = node.getParentIfKind(SyntaxKind.CallExpression)?.getExpressionIfKind(SyntaxKind.CallExpression);
    if (harness === undefined) return;
    // A nested layer owns its callback's services and may replace FileSystem.
    if (isHarnessMethodCall(harness, imports, "layer") && O.contains(harnessCallback(harness), node)) {
      traversal.skip();
    }
  });

// Queues each newly reached same-file helper once, so recursive helpers terminate.
// A call site wrapped by a provider may run the helper against another FileSystem,
// so its helper is not followed and the import stays flagged for review.
const appendCalledHelpers = (
  calls: ReadonlyArray<CallExpression>,
  region: MorphNode,
  regions: Array<MorphNode>,
  imports: EffectVitestImports
): void => {
  if (regionUpdatesScope(calls, imports)) return;
  for (const call of calls) {
    // Resolve the helper first: the call-site checks walk references and run only for helper calls.
    const helper = calledHelper(call, imports);
    if (
      O.isSome(helper) &&
      !A.some(regions, (known) => known === helper.value) &&
      !wrappedByProvider(call, region, imports) &&
      boundValueSafe(call, region, imports)
    )
      regions.push(helper.value);
  }
};

const harnessProvesNativeFileSystem = (flow: HarnessFlow, imports: EffectVitestImports): boolean =>
  O.exists(harnessCallback(flow.harness), (callback) => {
    const services = A.empty<VariableDeclaration>();
    const calls = A.empty<CallExpression>();
    // The callback plus every same-file helper it reaches by name, each visited once;
    // for-of also visits the helpers appended while it runs.
    const regions: Array<MorphNode> = [callback];
    for (const region of regions) {
      const known = calls.length;
      collectFileSystemEvidence(region, imports, services, calls);
      appendCalledHelpers(A.drop(calls, known), region, regions, imports);
    }
    return (
      !A.isReadonlyArrayEmpty(services) &&
      (flow.subject || A.some(calls, (call) => isNativeFileSystemOperation(call, services, imports)))
    );
  });

// Imported values can carry filesystem effects even when passed without calling them.
// Unbound runtime I/O globals are opaque; local shadowing remains lexical.
const opaquePlatformReference = (reference: Identifier, imports: EffectVitestImports): boolean => {
  const binding = imports.resolveBinding(reference);
  if (O.isNone(binding)) return A.contains(["Bun", "require", "process", "globalThis", "global"], reference.getText());
  // Loop heads have a declaration list but no variable statement; catch bindings have neither.
  if (Node.isVariableDeclaration(binding.value)) {
    const declaration = binding.value;
    const declarations = declaration.getParentIfKind(SyntaxKind.VariableDeclarationList);
    if (declarations === undefined || declarations.getDeclarationKind() === "const") return false;
    // A mutable declaration is opaque only if a later write can replace its initializer.
    return A.some(declaration.getSourceFile().getDescendantsOfKind(SyntaxKind.Identifier), (candidate) => {
      if (
        (candidate.getStart() >= declaration.getStart() && candidate.getEnd() <= declaration.getEnd()) ||
        !O.contains(imports.resolveBinding(candidate), declaration)
      )
        return false;
      return A.some(candidate.getAncestors(), (ancestor) => {
        if (Node.isForInStatement(ancestor) || Node.isForOfStatement(ancestor))
          return candidate.getEnd() <= ancestor.getInitializer().getEnd();
        if (Node.isBinaryExpression(ancestor)) {
          const operator = ancestor.getOperatorToken().getKind();
          return (
            operator >= SyntaxKind.FirstAssignment &&
            operator <= SyntaxKind.LastAssignment &&
            candidate.getEnd() <= ancestor.getLeft().getEnd()
          );
        }
        return (
          (Node.isPrefixUnaryExpression(ancestor) || Node.isPostfixUnaryExpression(ancestor)) &&
          A.contains([SyntaxKind.PlusPlusToken, SyntaxKind.MinusMinusToken], ancestor.getOperatorToken())
        );
      });
    });
  }
  if (!Node.isImportDeclaration(binding.value)) return false;
  const module = binding.value.getModuleSpecifierValue();
  return (
    module !== "effect" &&
    !Str.startsWith("effect/")(module) &&
    !A.contains(["@effect/vitest", "@beep/test-runner", "@beep/test-utils/Vitest"], module)
  );
};

// Follow local values as well as helpers: an initializer can hide an imported effect,
// runtime alias or an Effect.fn pipeline that helperBody deliberately cannot open.
// Include the region itself because an alias initializer may be just one identifier.
const harnessHasOpaquePlatformReferences = (harness: CallExpression, imports: EffectVitestImports): boolean =>
  O.exists(harnessCallback(harness), (callback) => {
    const regions: Array<MorphNode> = [callback];
    for (const region of regions) {
      const nodes = [region, ...region.getDescendants()];
      if (
        A.some(
          nodes,
          (node) => Node.isCallExpression(node) && node.getExpression().getKind() === SyntaxKind.ImportKeyword
        )
      )
        return true;
      const references = A.filter(
        A.filter(nodes, Node.isIdentifier),
        (reference) =>
          !isNamePosition(reference) && reference.getFirstAncestorByKind(SyntaxKind.ImportDeclaration) === undefined
      );
      if (A.some(references, (reference) => opaquePlatformReference(reference, imports))) return true;
      const reached = A.getSomes(
        A.map(references, (reference) =>
          O.flatMap(imports.resolveBinding(reference), (binding) =>
            helperBody(binding, imports).pipe(
              O.orElse(() =>
                Node.isVariableDeclaration(binding) ? O.fromUndefinedOr(binding.getInitializer()) : O.none()
              )
            )
          )
        )
      );
      // Deduplicate this batch as well as previously queued regions, including recursive aliases.
      regions.push(
        ...A.filter(
          A.dedupeWith(reached, (left, right) => left === right),
          (next) => !A.some(regions, (known) => known === next)
        )
      );
    }
    return false;
  });

// A services bundle used only by the shared harness is not filesystem evidence.
// Keep portable filesystem candidates unless the existing native-subject proof succeeds.
const canonicalPlatformIntegration = (declaration: ImportDeclaration, imports: EffectVitestImports): boolean =>
  O.exists(servicesBundleLayers(declaration, imports), (layers) => {
    const visited: FlowCache = MutableHashMap.empty();
    return O.exists(O.all(A.map(layers, (layer) => harnessFlows(layer, imports, [], false, visited))), (nested) => {
      const flows = A.flatten(nested);
      const harnesses = A.dedupeWith(
        A.map(flows, ({ harness }) => harness),
        (left, right) => left === right
      );
      const readsFileSystem = A.some(
        declaration.getSourceFile().getDescendants(),
        (node) =>
          Node.isExpression(node) &&
          node.getFirstAncestorByKind(SyntaxKind.ImportDeclaration) === undefined &&
          (!Node.isIdentifier(node) || !isNamePosition(node)) &&
          isProvenanceExpression(node, imports, ["effect", "effect/FileSystem"], "FileSystem", ["FileSystem"])
      );
      return (
        !A.isReadonlyArrayEmpty(harnesses) &&
        A.every(
          harnesses,
          (harness) =>
            (!readsFileSystem &&
              O.isSome(harnessCallback(harness)) &&
              !harnessHasOpaquePlatformReferences(harness, imports)) ||
            harnessProvesNativeFileSystem(
              { harness, subject: A.some(flows, (flow) => flow.harness === harness && flow.subject) },
              imports
            )
        )
      );
    });
  });

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

// Length delimiters keep token and title boundaries unambiguous; literal text
// is retained verbatim instead of collapsing significant string whitespace.
const harnessLabelParts = (node: MorphNode, imports: EffectVitestImports): ReadonlyArray<string> => {
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
      : A.empty<string>()
  );
  return A.map(A.flatten(labels), (label) => `${label.length}:${label}`);
};

// Stream the same getChildren leaves in preorder, including ts-morph's
// synthetic comments and empty syntax lists, without materializing every
// descendant or resuming a generator at each ancestor level.
const statementTokenParts = (statement: MorphNode): Array<string> => {
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
  return tokenParts;
};

const statementTokenDigest = Effect.fnUntraced(function* (
  statement: MorphNode,
  statements: MutableHashMap.MutableHashMap<number, string>
) {
  const cached = MutableHashMap.get(statements, statement.getStart());
  if (O.isSome(cached)) {
    return cached.value;
  }
  const crypto = yield* Crypto.Crypto;
  const tokens = Hex.encode(
    yield* crypto
      .digest("SHA-256", new TextEncoder().encode(A.join(statementTokenParts(statement), "")))
      .pipe(EffectVitestLintError.mapError("Failed to hash Effect Vitest statement tokens."))
  );
  MutableHashMap.set(statements, statement.getStart(), tokens);
  return tokens;
});

const occurrenceAnchor = Effect.fnUntraced(function* (
  node: MorphNode,
  imports: EffectVitestImports,
  statements: MutableHashMap.MutableHashMap<number, string>
) {
  const crypto = yield* Crypto.Crypto;
  const statement = node.getFirstAncestor((ancestor) => Node.isStatement(ancestor)) ?? node;
  const tokens = yield* statementTokenDigest(statement, statements);
  const digest = yield* crypto
    .digest("SHA-256", new TextEncoder().encode(`${A.join(harnessLabelParts(node, imports), "")}${tokens}`))
    .pipe(EffectVitestLintError.mapError("Failed to hash Effect Vitest occurrence identity."));
  return `v2:${Hex.encode(digest)}`;
});

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
  readonly providerNames: HashSet.HashSet<string>;
  readonly calls: ReadonlyArray<CallExpression>;
  readonly file: string;
  readonly owner: string;
  readonly layers: LayerAnalysis;
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
  const publicProvider = isPublicLayerProvider(call, imports);
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

const providesBuiltLayer = (layer: Expression, imports: EffectVitestImports): boolean =>
  !isPureStubLayer(layer, imports) && !isContextProvision(layer, imports);

// A context bound from `yield* Layer.build(...)` was built once; providing it again starts no new lifecycle.
const isBuiltContext = (layer: Expression, imports: EffectVitestImports): boolean =>
  Node.isIdentifier(layer) &&
  O.exists(localInitializer(layer, imports), (initializer) => {
    const built = Node.isYieldExpression(initializer) ? initializer.getExpression() : initializer;
    return (
      Node.isCallExpression(built) &&
      isProvenanceCall(built, imports, LAYER_MODULES, "Layer", ["build", "buildWithScope"])
    );
  });

const startsLayerLifecycle = (layer: Expression, imports: EffectVitestImports): boolean =>
  providesBuiltLayer(layer, imports) && !isBuiltContext(layer, imports);

const isLayerProvisionCall = (call: CallExpression, imports: EffectVitestImports): boolean =>
  !Node.isCallExpression(call.getExpression()) &&
  (isPublicLayerProvider(call, imports) || isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["provide"]));

// Variables declared inside the test callback that a provided layer expression reads.
const testBodyBindings = (
  layer: MorphNode,
  callback: EffectVitestFunctionNode,
  imports: EffectVitestImports
): ReadonlyArray<MorphNode> =>
  A.flatMap(
    [...(Node.isIdentifier(layer) ? [layer] : []), ...layer.getDescendantsOfKind(SyntaxKind.Identifier)],
    (reference) =>
      isNamePosition(reference)
        ? []
        : O.toArray(
            O.filter(
              imports.resolveBinding(reference),
              (declaration) =>
                (Node.isVariableDeclaration(declaration) || Node.isBindingElement(declaration)) &&
                containsNode(callback, declaration)
            )
          )
  );

const LAYER_COMBINATORS = ["merge", "mergeAll", "provide", "provideMerge", "fresh"];
const LAYER_VALUES = [...LAYER_COMBINATORS, "succeed", "sync", "effect", "scoped", "unwrap", "mock", "empty"];

const yieldedOperand = (initializer: Expression): O.Option<Expression> =>
  Node.isYieldExpression(initializer) ? O.fromUndefinedOr(initializer.getExpression()) : O.some(initializer);

// `yield* Path.Path` or `yield* FileSystem.FileSystem` reads a service tag; refs and config layers hold no store.
const isUtilityInitializer = (initializer: Expression, imports: EffectVitestImports): boolean =>
  O.match(yieldedOperand(initializer), {
    onNone: constTrue,
    onSome: (operand) =>
      (Node.isYieldExpression(initializer) &&
        (Node.isIdentifier(operand) || Node.isPropertyAccessExpression(operand)) &&
        O.isSome(Str.match(/^[A-Z]/u)(Node.isIdentifier(operand) ? operand.getText() : operand.getName()))) ||
      (Node.isCallExpression(operand) &&
        (isProvenanceCall(operand, imports, REF_MODULES, "Ref", ["make"]) ||
          isProvenanceCall(operand, imports, CONFIG_PROVIDER_MODULES, "ConfigProvider", ["layer", "layerAdd"]))),
  });

const isLayerValue = (expression: Expression, imports: EffectVitestImports): boolean =>
  Node.isCallExpression(expression) &&
  (isProvenanceCall(expression, imports, LAYER_MODULES, "Layer", LAYER_VALUES) ||
    isProvenanceCall(expression, imports, CONTEXT_MODULES, "Context", ["make", "add", "merge", "empty"]));

const isLayerCombinator = (call: CallExpression, imports: EffectVitestImports): boolean =>
  isProvenanceCall(call, imports, LAYER_MODULES, "Layer", LAYER_COMBINATORS);

const bodyDeclarationInitializer = (declaration: MorphNode): O.Option<Expression> =>
  Node.isVariableDeclaration(declaration)
    ? O.fromUndefinedOr(declaration.getInitializer())
    : O.fromUndefinedOr(declaration.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)?.getInitializer());

// Test-body values a layer reads directly that can name its store: a directory, a path, a fixture. Service
// tags, refs and config layers never count; layer-valued bindings are followed but are not evidence themselves,
// and other values are not followed, so two stores derived from one corpus root stay distinct.
const storeEvidence = (
  node: MorphNode,
  callback: EffectVitestFunctionNode,
  imports: EffectVitestImports,
  seen: Array<MorphNode>
): ReadonlyArray<MorphNode> =>
  A.flatMap(testBodyBindings(node, callback, imports), (declaration) => {
    if (A.some(seen, (visited) => visited === declaration)) return [];
    seen.push(declaration);
    return O.match(bodyDeclarationInitializer(declaration), {
      onNone: () => [declaration],
      onSome: (initializer) => {
        if (isUtilityInitializer(initializer, imports) || isFunctionValue(initializer)) return [];
        return O.exists(yieldedOperand(initializer), (operand) => isLayerValue(operand, imports))
          ? storeEvidence(initializer, callback, imports, seen)
          : [declaration];
      },
    });
  });

// A store-reading factory argument: its normalized text plus the test-body declarations its identifiers resolve
// to, so same-named bindings in nested or sibling scopes (two `const dataDir`) stay distinct stores (#2196).
type ArgumentEvidence = { readonly text: string; readonly bindings: ReadonlyArray<MorphNode> };

type StoreEvidence = MorphNode | ArgumentEvidence;

type LifecycleKey = { readonly key: MorphNode | string; readonly evidence: ReadonlyArray<StoreEvidence> };

// Generic constructors name no store themselves: `Layer.effect(StoreA, openA(dir))` and
// `Layer.effect(StoreB, openB(dir))` are different layers, so their key is the whole normalized call.
const GENERIC_LAYER_CONSTRUCTORS = ["succeed", "sync", "effect", "scoped", "unwrap", "mock"];

const normalizedText = (node: MorphNode): string => Str.replace(/\s+/gu, "")(node.getText());

// A factory argument names its store by its whole expression bound to its store-evidence declarations, so
// `path.join(root, "a")` and `path.join(root, "b")` stay distinct, and so do two `dataDir` bindings declared
// in different scopes, while a per-scope `const path = yield* Path.Path` never splits one store; object
// arguments compare property by property.
const argumentStoreEvidence = (
  argument: MorphNode,
  callback: EffectVitestFunctionNode,
  imports: EffectVitestImports
): ReadonlyArray<ArgumentEvidence> =>
  A.flatMap(Node.isObjectLiteralExpression(argument) ? argument.getProperties() : [argument], (part) => {
    const bindings = storeEvidence(part, callback, imports, []);
    return A.isReadonlyArrayNonEmpty(bindings) ? [{ text: normalizedText(part), bindings }] : [];
  });

// The constructors a provided layer builds: a test-body layer binding (and what it builds), a project
// factory call named by its callee, or a generic Layer constructor named by its whole call. Layer
// combinators and `.pipe` stages contribute their operands.
const lifecycleKeys = (
  layer: MorphNode,
  callback: EffectVitestFunctionNode,
  imports: EffectVitestImports,
  seen: Array<MorphNode>
): ReadonlyArray<LifecycleKey> => {
  if (Node.isIdentifier(layer)) {
    return A.flatMap(testBodyBindings(layer, callback, imports), (declaration) => {
      if (!Node.isVariableDeclaration(declaration) || A.some(seen, (visited) => visited === declaration)) return [];
      seen.push(declaration);
      return O.match(bodyDeclarationInitializer(declaration), {
        onNone: () => [],
        onSome: (initializer) =>
          isUtilityInitializer(initializer, imports)
            ? []
            : [
                { key: declaration, evidence: storeEvidence(initializer, callback, imports, []) },
                ...lifecycleKeys(initializer, callback, imports, seen),
              ],
      });
    });
  }
  if (!Node.isCallExpression(layer)) return [];
  const callee = layer.getExpression();
  if (isLayerCombinator(layer, imports))
    return A.flatMap(layer.getArguments(), (argument) => lifecycleKeys(argument, callback, imports, seen));
  if (Node.isPropertyAccessExpression(callee) && callee.getName() === "pipe")
    return A.flatMap([callee.getExpression(), ...layer.getArguments()], (part) =>
      lifecycleKeys(part, callback, imports, seen)
    );
  return [
    {
      key: isProvenanceCall(layer, imports, LAYER_MODULES, "Layer", GENERIC_LAYER_CONSTRUCTORS)
        ? normalizedText(layer)
        : normalizedText(callee),
      evidence: A.flatMap(layer.getArguments(), (argument) => argumentStoreEvidence(argument, callback, imports)),
    },
  ];
};

// Identity, not `Equal`: structural equality over ts-morph nodes walks the whole tree.
const sameBindings = (left: ReadonlyArray<MorphNode>, right: ReadonlyArray<MorphNode>): boolean =>
  left.length === right.length && A.every(left, (binding, index) => binding === right[index]);

const sameEvidence = (left: StoreEvidence, right: StoreEvidence): boolean =>
  Node.isNode(left) || Node.isNode(right)
    ? left === right
    : left.text === right.text && sameBindings(left.bindings, right.bindings);

const sharesLifecycle = (left: LifecycleKey, right: LifecycleKey): boolean =>
  left.key === right.key &&
  A.some(left.evidence, (value) => A.some(right.evidence, (other) => sameEvidence(value, other)));

// `it.layer` builds one layer per block. A test that provides the same layer binding or factory twice over
// one test-body store value (open, close, reopen one store) owns several lifecycles `it.layer` cannot express.
const repeatsTestBodyLifecycle = (node: MorphNode, layer: Expression, state: DetectorState): boolean =>
  O.exists(state.harness.enclosingTest(node), ({ callback }) => {
    const { imports } = state;
    const own = startsLayerLifecycle(layer, imports) ? lifecycleKeys(layer, callback, imports, []) : [];
    return (
      A.isReadonlyArrayNonEmpty(own) &&
      A.some(
        callbackCalls(callback),
        (other) =>
          other !== node &&
          isLayerProvisionCall(other, imports) &&
          O.exists(
            providedLayer(other),
            (provided) =>
              startsLayerLifecycle(provided, imports) &&
              A.some(lifecycleKeys(provided, callback, imports, []), (key) =>
                A.some(own, (read) => sharesLifecycle(read, key))
              )
          )
      )
    );
  });

const emitLayerProvision = (
  node: MorphNode,
  layer: O.Option<Expression>,
  symbol: string,
  state: DetectorState
): void => {
  const { imports, makeFinding, findings, file, owner } = state;
  if (O.exists(layer, (value) => providesBuiltLayer(value, imports) && !repeatsTestBodyLifecycle(node, value, state))) {
    const unresolved = !O.exists(layer, (value) => isResourceExpression(value, imports));
    findings.push(
      makeFinding({
        ruleId: "EV002",
        node,
        file,
        owner,
        symbol,
        judgment: unresolved,
        ...(unresolved ? { className: "unresolved-layer-provide" } : {}),
      })
    );
  }
};

const detectLayerProvision = (
  { call, member, effectTest, publicProvider, localProvider, definition }: ReturnType<typeof inspectContext>,
  state: DetectorState
): void => {
  const { imports } = state;

  if (
    !Node.isCallExpression(call.getExpression()) &&
    (publicProvider || localProvider || isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["provide"])) &&
    effectRegistrationBody(call, effectTest, imports)
  ) {
    const layer = localProvider
      ? O.flatMap(definition, ({ node }) => callerProvidedLayer(call, node, imports))
      : providedLayer(call);
    emitLayerProvision(call, layer, member, state);
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
      O.exists(definition, ({ node }) => functionHasShareableResource(node, imports))) &&
    (rootTestBodyCall(call, imports) || O.exists(test, ({ callback }) => isWholeBodyCall(call, callback)))
  ) {
    if (O.exists(definition, ({ node }) => functionHasShareableResource(node, imports))) {
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

const scopeLifetimeClass = (
  call: CallExpression,
  helper: ReturnType<EffectVitestHarnessIndex["reachableHelper"]>
): string =>
  O.match(helper, {
    onNone: () => "shorter-scope-lifetime-review",
    onSome: ({ callback, shared, plain }) =>
      shared || plain
        ? "shared-helper-scope-lifetime-review"
        : isWholeBodyCall(call, callback)
          ? "helper-scope-lifetime-review"
          : "inner-helper-scope-lifetime-review",
  });

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
    const scopeClass = scopeLifetimeClass(call, helper);
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
    findings.push(makeFinding({ ruleId: "EV005", node: call, file, owner, symbol: callMember(call), judgment: true }));
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

const isOptionContainsCall = (call: CallExpression, imports: EffectVitestImports): boolean => {
  const expression = call.getExpression();
  return (
    (call.getArguments().length === 2 && isProvenanceCall(call, imports, OPTION_MODULES, "Option", ["contains"])) ||
    (call.getArguments().length === 1 &&
      Node.isCallExpression(expression) &&
      expression.getArguments().length === 1 &&
      isProvenanceCall(expression, imports, OPTION_MODULES, "Option", ["contains"]))
  );
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
  if (
    O.isSome(truth) &&
    Node.isCallExpression(actual) &&
    (isOptionContainsCall(actual, imports) || arrayPredicateDataShape(actual, imports))
  ) {
    return {
      judgment: true,
      replacement: EffectVitestReplacement.make({
        primitive: truth.value ? "utils.assertTrue" : "utils.assertFalse",
        sketch:
          "Preserve the complete Boolean membership or aggregate predicate, its operands and truth polarity. Membership retains Effect Equal semantics; do not invent payload or structural equality expectations.",
      }),
    };
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

const pipedAbsenceAssertion = (call: CallExpression, imports: EffectVitestImports) => {
  const pipeStage = O.getOrUndefined(terminalPipeStage(call, imports));
  const arguments_ = call.getArguments();
  const predicateStage = arguments_[arguments_.length - 2];
  if (!Node.isExpression(pipeStage) || !Node.isExpression(predicateStage)) return O.none();
  return A.findFirst(
    [
      { predicate: "isNone", assertion: "assertTrue", truth: true },
      { predicate: "isSome", assertion: "assertFalse", truth: false },
    ],
    ({ predicate, assertion }) =>
      isProvenanceExpression(predicateStage, imports, OPTION_MODULES, "Option", [predicate]) &&
      isProvenanceExpression(pipeStage, imports, ["@effect/vitest/utils"], "utils", [assertion])
  ).pipe(O.map(({ predicate, truth }) => predicateAssertionReplacement("Option", predicate, truth)));
};

const predicateFamilies = [
  { family: "Option", modules: OPTION_MODULES, members: ["isSome", "isNone"] },
  { family: "Result", modules: RESULT_MODULES, members: ["isSuccess", "isFailure"] },
  { family: "Exit", modules: EXIT_MODULES, members: ["isSuccess", "isFailure"] },
];

// `value.pipe(O.isSome)` / `pipe(value, O.isSome)`: the terminal stage is a predicate reference.
const pipedPredicateDescription = (node: MorphNode | undefined, imports: EffectVitestImports) =>
  O.flatMap(Node.isCallExpression(node) ? terminalPipeStage(node, imports) : O.none(), (stage) =>
    Node.isExpression(stage)
      ? A.head(
          A.getSomes(
            A.map(predicateFamilies, ({ family, modules, members }) =>
              A.findFirst(members, (member) => isProvenanceExpression(stage, imports, modules, family, [member])).pipe(
                O.map((member) => ({ family, member }))
              )
            )
          )
        )
      : O.none()
  );

const isCompoundBoolean = (node: MorphNode | undefined): boolean => {
  const expression = Node.isParenthesizedExpression(node) ? node.getExpression() : node;
  return (
    Node.isBinaryExpression(expression) &&
    A.contains([SyntaxKind.AmpersandAmpersandToken, SyntaxKind.BarBarToken], expression.getOperatorToken().getKind())
  );
};

// A canonical utils.assertTrue/assertFalse already states a compound Boolean
// predicate, or a piped predicate whose recommended primitive is that same helper.
const isCanonicalBooleanForm = (call: CallExpression, imports: EffectVitestImports): boolean =>
  A.some([true, false], (truth) => {
    const helper = truth ? "assertTrue" : "assertFalse";
    if (!isProvenanceCall(call, imports, ["@effect/vitest/utils"], "utils", [helper])) return false;
    const actual = call.getArguments()[0];
    return (
      isCompoundBoolean(actual) ||
      O.exists(
        pipedPredicateDescription(actual, imports),
        ({ family, member }) => predicateAssertionReplacement(family, member, truth).primitive === `utils.${helper}`
      )
    );
  });

const isReviewableBooleanAssertion = (call: CallExpression, imports: EffectVitestImports): boolean =>
  isBooleanAssertion(call, imports) &&
  A.some(call.getArguments(), (argument) => containsDataShape(argument, imports)) &&
  !isCanonicalBooleanForm(call, imports);

const detectBooleanDataShape = (
  { call, member, inTest }: ReturnType<typeof inspectContext>,
  state: DetectorState
): void => {
  const { imports, makeFinding, findings, file, owner } = state;
  if (!inTest) return;
  const absence = pipedAbsenceAssertion(call, imports);
  if (O.isSome(absence)) {
    findings.push(
      makeFinding({
        ruleId: "EV006",
        node: call,
        file,
        owner,
        symbol: member,
        judgment: false,
        replacement: absence.value,
      })
    );
    return;
  }
  if (!isReviewableBooleanAssertion(call, imports)) return;
  const route = dataAssertionRoute(
    call.getArguments()[0],
    undefined,
    booleanAssertionTruth(call, imports),
    false,
    imports
  );
  if (
    (route.replacement.primitive === "utils.assertTrue" &&
      isProvenanceCall(call, imports, ["@effect/vitest/utils"], "utils", ["assertTrue"])) ||
    (route.replacement.primitive === "utils.assertFalse" &&
      isProvenanceCall(call, imports, ["@effect/vitest/utils"], "utils", ["assertFalse"]))
  )
    return;
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
  // Syntax nodes are graph identities, not values for structural equality.
  if (O.isNone(owner) || A.some(seen, (visited) => visited === owner.value)) return false;
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
  if (O.exists(test, ({ callback }) => controlledWait(call, callback, imports))) return;
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
  const { imports, makeFinding, findings, file, owner, layers } = state;

  if (isHarnessMethodCall(call, imports, "layer") && !Node.isCallExpression(call.getExpression())) {
    const layer = call.getArguments()[0];
    if (Node.isExpression(layer) && !layerHasTimeout(call) && !isAcquisitionFreeLayer(layer, layers)) {
      findings.push(makeFinding({ ruleId: "EV014", node: call, file, owner, symbol: "it.layer", judgment: true }));
    }
  }
};

// `each`, `for` and `prop` register several cases from one call; a curried callee does the same.
const MULTI_CASE_MEMBERS = ["each", "for", "prop", "propEffect"];

const isSingleCaseRegistration = (registration: CallExpression): boolean => {
  const callee = registration.getExpression();
  return (
    !Node.isCallExpression(callee) &&
    callee.getFirstDescendantByKind(SyntaxKind.CallExpression) === undefined &&
    !A.some(callee.getDescendantsOfKind(SyntaxKind.Identifier), (name) =>
      A.contains(MULTI_CASE_MEMBERS, name.getText())
    )
  );
};

const isDirectBlockStatement = (registration: CallExpression, block: EffectVitestFunctionNode): boolean => {
  const body = block.getBody();
  const statement = registration.getParent();
  return body === registration || (Node.isExpressionStatement(statement) && statement.getParent() === body);
};

// The block's tester may only appear as the base of its one registration, never passed to a helper.
const testerConfinedTo = (registration: CallExpression, block: EffectVitestFunctionNode): boolean =>
  A.every(block.getParameters(), (parameter) => {
    const name = parameter.getNameNode();
    return (
      Node.isIdentifier(name) &&
      A.every(
        block.getDescendantsOfKind(SyntaxKind.Identifier),
        (reference) =>
          reference === name ||
          reference.getText() !== name.getText() ||
          isNamePosition(reference) ||
          containsNode(registration.getExpression(), reference)
      )
    );
  });

// `@effect/vitest` builds every top-level `it.layer` in a fresh memo map, so its TestClock is the block's
// own. Nested blocks fork the parent's memo map and share its TestClock, so they never qualify.
const ownsUnsharedTestClock = (block: EffectVitestFunctionNode, adjust: CallExpression, state: DetectorState) =>
  O.isNone(state.harness.enclosingLayerBlock(block)) &&
  A.match(
    A.filter(callbackCalls(block), (call) => O.isSome(classifyHarnessCall(call, state.imports))),
    {
      onEmpty: constFalse,
      onNonEmpty: ([registration, ...rest]) =>
        A.isReadonlyArrayEmpty(rest) &&
        containsNode(registration, adjust) &&
        isSingleCaseRegistration(registration) &&
        isDirectBlockStatement(registration, block) &&
        testerConfinedTo(registration, block),
    }
  );

const detectLayerClockReset = ({ call, member }: ReturnType<typeof inspectContext>, state: DetectorState): void => {
  const { imports, harness, makeFinding, findings, file, owner } = state;

  if (member === "adjust" && isProvenanceCall(call, imports, TEST_CLOCK_MODULES, "TestClock", ["adjust"])) {
    const layer = harness.enclosingLayerBlock(call);
    if (O.exists(layer, (block) => !ownsUnsharedTestClock(block, call, state))) {
      findings.push(
        makeFinding({ ruleId: "EV015", node: call, file, owner, symbol: "TestClock.adjust", judgment: true })
      );
    }
  }
};

// Vitest's transform requires its own vi binding for hoisted module mocks.
// Registration/assertion imports still belong to the Effect test harness.
const requiresVitestMockHoisting = (declaration: ImportDeclaration, imports: EffectVitestImports): boolean => {
  const named = declaration.getNamedImports();
  if (
    declaration.getDefaultImport() !== undefined ||
    declaration.getNamespaceImport() !== undefined ||
    named.length !== 1 ||
    named[0]?.getName() !== "vi"
  )
    return false;
  return A.some(imports.calls, (call) => {
    const callee = call.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return false;
    const receiver = callee.getExpression();
    return (
      Node.isIdentifier(receiver) &&
      A.contains(["mock", "hoisted"], callee.getName()) &&
      O.exists(imports.resolveBinding(receiver), (binding) => binding === declaration)
    );
  });
};

const appliedStages = (
  call: CallExpression,
  member: string,
  imports: EffectVitestImports
): ReadonlyArray<MorphNode> => {
  const candidate =
    member === "pipe" ||
    member === "fnUntraced" ||
    O.exists(MutableHashMap.get(imports.bindingsByLocal, member), (bindings) =>
      A.some(bindings, (binding) => binding.imported === "pipe" || binding.imported === "fnUntraced")
    );
  if (!candidate) return [];

  const expression = call.getExpression();
  if (Node.isPropertyAccessExpression(expression) && expression.getName() === "pipe") return call.getArguments();
  if (
    isProvenanceCall(call, imports, ["effect", "effect/Function"], "Function", ["pipe"]) ||
    isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["fnUntraced"])
  )
    return A.drop(call.getArguments(), 1);
  return [];
};

const providerCandidateNames = (imports: EffectVitestImports): HashSet.HashSet<string> =>
  HashSet.fromIterable(
    A.map(
      A.filter(imports.variables, (declaration) => {
        const initializer = declaration.getInitializer();
        return (
          Node.isIdentifier(initializer) ||
          (Node.isCallExpression(initializer) &&
            initializer.getArguments().length === 1 &&
            (isPublicLayerProvider(initializer, imports) ||
              isProvenanceCall(initializer, imports, EFFECT_MODULES, "Effect", ["provide"])))
        );
      }),
      (declaration) => declaration.getName()
    )
  );

const isProviderReference = (node: MorphNode, state: DetectorState): boolean =>
  Node.isIdentifier(node) && HashSet.has(state.providerNames, node.getText());

const boundProviderLayer = (
  expression: MorphNode,
  imports: EffectVitestImports,
  seen: ReadonlyArray<MorphNode> = []
): O.Option<Expression> => {
  if (!Node.isIdentifier(expression)) return O.none();
  return imports.resolveBinding(expression).pipe(
    O.filter(Node.isVariableDeclaration),
    O.filter(
      (binding) =>
        binding.getVariableStatement()?.getDeclarationKind() === "const" && !A.some(seen, (prior) => prior === binding)
    ),
    O.flatMap((binding) => {
      const initializer = binding.getInitializer();
      if (initializer === undefined) return O.none();
      if (Node.isIdentifier(initializer)) return boundProviderLayer(initializer, imports, [...seen, binding]);
      return Node.isCallExpression(initializer) &&
        initializer.getArguments().length === 1 &&
        (isPublicLayerProvider(initializer, imports) ||
          isProvenanceCall(initializer, imports, EFFECT_MODULES, "Effect", ["provide"]))
        ? providedLayer(initializer)
        : O.none();
    })
  );
};

const directlyRegisteredEffect = (call: CallExpression, imports: EffectVitestImports): boolean =>
  rootTestBodyCall(call, imports) &&
  O.exists(O.fromUndefinedOr(call.getParentIfKind(SyntaxKind.CallExpression)), (parent) =>
    O.exists(classifyHarnessCall(parent, imports), (mode) => mode === "effect" || mode === "live")
  );

const scopeReferenceWholeBody = (call: CallExpression, state: DetectorState): boolean => {
  const { imports, harness } = state;
  if (isProvenanceCall(call, imports, EFFECT_MODULES, "Effect", ["fnUntraced"])) {
    const body = call.getArguments()[0];
    return directlyRegisteredEffect(call, imports) && (Node.isFunctionExpression(body) || Node.isArrowFunction(body));
  }
  return O.exists(
    harness.enclosingTest(call),
    ({ callback }) =>
      isWholeBodyCall(call, callback) &&
      !(Node.isFunctionExpression(callback) && callback.getAsteriskToken() !== undefined) &&
      !Node.isExpressionStatement(call.getParent())
  );
};

const detectAppliedScope = (
  call: CallExpression,
  stage: MorphNode,
  finalStage: boolean,
  state: DetectorState
): void => {
  const { imports, harness, makeFinding, findings, file, owner } = state;
  if (!Node.isExpression(stage) || !isProvenanceExpression(stage, imports, EFFECT_MODULES, "Effect", ["scoped"]))
    return;
  const test = harness.enclosingTest(call);
  const helper = harness.reachableHelper(call);
  const inEffect =
    O.exists(test, ({ mode }) => mode === "effect" || mode === "live") || directlyRegisteredEffect(call, imports);
  if (!inEffect && !O.exists(helper, ({ effect }) => effect)) return;
  const wholeBody = finalStage && scopeReferenceWholeBody(call, state);
  const scopeClass = scopeLifetimeClass(call, helper);
  findings.push(
    makeFinding({
      ruleId: "EV004",
      node: stage,
      file,
      owner,
      symbol: "scoped",
      judgment: !wholeBody,
      ...(wholeBody ? {} : { className: scopeClass }),
    })
  );
};

const detectAppliedReferences = (call: CallExpression, member: string, state: DetectorState): void => {
  const stages = appliedStages(call, member, state.imports);
  const callee = call.getExpression();
  if (A.isReadonlyArrayEmpty(stages) && !isProviderReference(callee, state)) return;
  A.forEach(stages, (stage, index) => detectAppliedScope(call, stage, index === stages.length - 1, state));
  // Resolve only applied provider references before walking test ancestry.
  // The lexical resolver remains authoritative for aliases and shadows.
  const providers = A.getSomes(
    A.map(
      A.filter([...stages, callee], (expression) => isProviderReference(expression, state)),
      (expression) => O.map(boundProviderLayer(expression, state.imports), (layer) => ({ expression, layer }))
    )
  );
  if (A.isReadonlyArrayEmpty(providers)) return;
  const inEffect =
    O.exists(state.harness.enclosingTest(call), ({ mode }) => mode === "effect" || mode === "live") ||
    directlyRegisteredEffect(call, state.imports);
  if (!inEffect) return;
  for (const { expression, layer } of providers)
    emitLayerProvision(expression, O.some(layer), expression.getText(), state);
};

const inspectCall = (call: CallExpression, state: DetectorState): void => {
  const { imports, helperNames } = state;

  const member = callMember(call);
  detectAppliedReferences(call, member, state);
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
  nativeFileSystem: LazyArg<boolean>,
  state: DetectorState
): void => {
  const { makeFinding, findings, file, owner } = state;
  const filesystemMember = moduleName === "@effect/platform-bun" ? "BunFileSystem" : "NodeFileSystem";
  const filesystem = platformFileSystemImport(moduleName) || osTemp || A.contains(members, filesystemMember);
  if (!filesystem && (!platformResourceReview(moduleName, members) || nativeFileSystem())) return;
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
  emitPlatformFinding(
    declaration,
    moduleName,
    members,
    osTemp,
    () => canonicalPlatformIntegration(declaration, imports),
    state
  );
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
  emitPlatformFinding(declaration, moduleName, members, osTemp, constFalse, state);
};

const detectResourceDefinition = (
  { name, node }: ReturnType<typeof sourceFunctionDefinitions>[number],
  state: DetectorState
): void => {
  const { imports, findings, makeFinding, file, owner } = state;
  const shareable = functionHasShareableResource(node, imports);
  if ((wrapperName(name) && shareable) || buildsAndProvidesLayer(node, imports))
    findings.push(makeFinding({ ruleId: "EV003", node, file, owner, symbol: name, judgment: !shareable }));
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
 *   'import * as Effect from "effect/Effect"; import { it } from "@effect/vitest"; it("runs", () => Effect.runSync(program))'
 * )
 * const findings = detectEffectVitestFindings(source, "packages/example/test/runtime.test.ts", "@beep/example")
 * console.log(A.map(findings, ({ ruleId }) => ruleId)) // ["EV001"]
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const detectEffectVitestFindings: {
  (
    sourceFile: SourceFile,
    file: string,
    owner: string
  ): Effect.Effect<ReadonlyArray<EffectVitestFinding>, EffectVitestLintError, Crypto.Crypto>;
  (
    file: string,
    owner: string
  ): (
    sourceFile: SourceFile
  ) => Effect.Effect<ReadonlyArray<EffectVitestFinding>, EffectVitestLintError, Crypto.Crypto>;
} = dual(
  3,
  Effect.fnUntraced(function* (sourceFile: SourceFile, file: string, owner: string) {
    const imports = collectEffectVitestImports(sourceFile);
    const harness = createEffectVitestHarnessIndex(sourceFile, imports);
    const statementDigests = MutableHashMap.empty<number, string>();
    const occurrenceNodes = MutableHashMap.empty<EffectVitestFinding, MorphNode>();
    const makeFinding = (input: FindingInput): EffectVitestFinding => {
      const finding = initialFinding(input);
      MutableHashMap.set(occurrenceNodes, finding, input.node);
      return finding;
    };
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
      providerNames: providerCandidateNames(imports),
      calls,
      file,
      owner,
      layers: makeLayerAnalysis(sourceFile, imports),
    };

    for (const call of calls) inspectCall(call, state);

    for (const definition of definitions) detectResourceDefinition(definition, state);
    for (const declaration of A.filter(
      imports.plainVitestImports,
      (declaration) => imports.hasEffectImport && !requiresVitestMockHoisting(declaration, imports)
    ))
      findings.push(makeFinding({ ruleId: "EV011", node: declaration, file, owner, symbol: "vitest-import" }));

    for (const declaration of sourceFile.getImportDeclarations()) detectPlatformImport(declaration, state);

    for (const call of calls) detectPlatformRequire(call, state);
    for (const loop of imports.loops) detectRetryLoop(loop, state);
    const anchored = yield* Effect.forEach(
      findings,
      Effect.fnUntraced(function* (finding) {
        const node = MutableHashMap.get(occurrenceNodes, finding);
        if (O.isNone(node)) {
          return yield* EffectVitestLintError.new(
            "An Effect Vitest finding has no source node for its occurrence identity."
          );
        }
        return EffectVitestFinding.make({
          ...finding,
          occurrence: O.some(yield* occurrenceAnchor(node.value, imports, statementDigests)),
        });
      }),
      { concurrency: 1 }
    );
    return assignStableIds(anchored);
  })
);
