/**
 * Confined evaluator for parsed CodeMode programs.
 *
 * **Details**
 *
 * Host callers should prefer {@link executeWithLimits}, which constructs this
 * class, copies results out, and applies budgets. Direct `run` is the inner
 * evaluation loop used by that entry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LiteralKit, SchemaUtils } from "@beep/schema";
import { type SafeObject, SafeObject as SafeObjectSchema } from "@beep/schema/SafeObject";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A, O, P, pipe, R, thunkFalse } from "@beep/utils";
import {
  Cause,
  type Context,
  DateTime,
  Deferred,
  Effect,
  Exit,
  Match,
  MutableHashMap,
  MutableHashSet,
  MutableRef,
  Random,
  Result,
} from "effect";
import * as S from "effect/Schema";
import {
  arrayMethods,
  arrayStatics,
  ConsoleMethod,
  dateMethods,
  dateStatics,
  mapMethods,
  mapStatics,
  mathMethods,
  numberMethods,
  numberStatics,
  objectStatics,
  regexpMethods,
  regexpStatics,
  setMethods,
  stringMethods,
  stringStatics,
  UrlMethod,
  UrlSearchParamsMethod,
  UrlStatic,
} from "../Codemode.method-names.ts";
import { isBlockedMember, ToolReference } from "../Codemode.tool-runtime.ts";
import {
  CodeModeDate,
  CodeModeMap,
  CodeModePromise,
  CodeModeRegExp,
  CodeModeSet,
  CodeModeURL,
  CodeModeURLSearchParams,
  isCodeModeValue,
  makeEmptySafeObject,
} from "../Codemode.values.ts";
import {
  AppliedBinaryOperator,
  AssignmentOperator,
  BinaryOperator,
  boundedData,
  CompoundOperator,
  coerceToNumber,
  coerceToString,
  errorBrandName,
  escapeRegexHint,
  formatConsoleMessage,
  invokeCoercion,
  invokeJsonMethod,
  invokeMathSumPrecise,
  invokeObjectFromEntries,
  invokeUriFunction,
  LogicalAssignmentOperator,
  LogicalOperator,
  mathConstants,
  numberConstants,
  objectMethodsPreservingIdentity,
  regexFailureReason,
  regexpProperties,
  UnaryOperator,
  UpdateOperator,
  uriArgument,
  urlArgument,
  urlProperties,
  urlWritableProperties,
  valueConstructors,
} from "../stdlib/index.ts";
import { caughtErrorValue, constructAggregateErrorValue, constructErrorValue } from "./Interpreter.errors.ts";
import { preserveConsumerError, type SyncIteratorRunner } from "./Interpreter.iterator.ts";
import {
  type CallbackRunner,
  invokeArrayFrom,
  invokeGlobalMethod,
  invokeGroupBy,
  invokeIntrinsic,
} from "./Interpreter.methods.ts";
import {
  AstNode,
  AsyncIteratorSymbol,
  asNode,
  Binding,
  CodeModeFunction,
  CodeModeGenerator,
  CoercionFunction,
  CoercionFunctionName,
  ComputedValue,
  ErrorConstructorName,
  ErrorConstructorReference,
  GeneratorMethodKind,
  GeneratorMethodReference,
  GeneratorRequestKind,
  GeneratorReturn,
  GlobalMethod,
  GlobalMethodReference,
  GlobalNamespace,
  GlobalNamespaceName,
  getArray,
  getBoolean,
  getNode,
  getOptionalNode,
  getString,
  InterpreterFailure,
  InterpreterRuntimeError,
  IntrinsicMethod,
  IntrinsicReference,
  IteratorSymbol,
  IteratorSymbols,
  isRecord,
  JsonMethodName,
  JsonMethodReference,
  MemberReference,
  OptionalShortCircuit,
  type ProgramNode,
  ProgramThrow,
  PromiseInstanceMethodReference,
  PromiseMethodName,
  PromiseMethodReference,
  PromiseNamespace,
  RuntimeReference,
  SearchFunction,
  StatementBreak,
  StatementContinue,
  StatementNone,
  StatementResult,
  StatementReturn,
  SymbolNamespace,
  tryInterpreter,
  UriFunction,
  unsupportedSyntax,
} from "./Interpreter.model.ts";
import {
  constructPromise,
  invokePromiseInstanceMethod,
  invokePromiseMethod,
  type PromiseRuntime,
  resolvePromise,
  resolvePromiseValue,
} from "./Interpreter.promises.ts";
import {
  containsOpaqueReference,
  isRuntimeReference,
  rejectCircularInsertion,
  typeofValue,
} from "./Interpreter.references.ts";
import { ScopeStack } from "./Interpreter.scope.ts";

const MAX_ARRAY_LENGTH = 4_294_967_295;
const encodeJson = UnknownFromJsonString.encodeUnknownSync;

const StatementNodeType = LiteralKit([
  "ExpressionStatement",
  "VariableDeclaration",
  "ReturnStatement",
  "BlockStatement",
  "IfStatement",
  "SwitchStatement",
  "LabeledStatement",
  "WhileStatement",
  "DoWhileStatement",
  "ForStatement",
  "ForOfStatement",
  "ForInStatement",
  "BreakStatement",
  "ContinueStatement",
  "ThrowStatement",
  "TryStatement",
  "EmptyStatement",
  "FunctionDeclaration",
]);

const ExpressionNodeType = LiteralKit([
  "ArrowFunctionExpression",
  "FunctionExpression",
  "Literal",
  "Identifier",
  "BinaryExpression",
  "LogicalExpression",
  "UnaryExpression",
  "AssignmentExpression",
  "SequenceExpression",
  "CallExpression",
  "MemberExpression",
  "ChainExpression",
  "ObjectExpression",
  "ArrayExpression",
  "TemplateLiteral",
  "ConditionalExpression",
  "UpdateExpression",
  "AwaitExpression",
  "YieldExpression",
  "NewExpression",
]);

const parseArrayIndex = (key: string | number): number | undefined => {
  const property = String(key);
  if (!/^(0|[1-9]\d*)$/.test(property)) return undefined;
  const index = Number(property);
  return index < MAX_ARRAY_LENGTH ? index : undefined;
};

const calleeDescription = (callee: AstNode): string => {
  if (callee.type === "Identifier") return getString(callee, "name");
  if (callee.type === "MemberExpression") {
    const object = getNode(callee, "object");
    const property = getNode(callee, "property");
    const key =
      callee.computed !== true && property.type === "Identifier"
        ? getString(property, "name")
        : property.type === "Literal" && P.isString(property.value)
          ? property.value
          : undefined;
    if (object.type === "Identifier" && P.isNotUndefined(key)) return `${getString(object, "name")}.${key}`;
  }
  return "The called value";
};

const instanceofValue = (lhs: unknown, rhs: unknown, node: AstNode): boolean => {
  const unsupported = (): never => {
    throw InterpreterRuntimeError.new(
      "The right-hand side of 'instanceof' must be a supported constructor: Error (or a specific error type like TypeError), Date, RegExp, Map, Set, URL, URLSearchParams, Array, Object, or Promise.",
      node
    );
  };

  if (RuntimeReference.guards.ErrorConstructorReference(rhs)) {
    const brand = errorBrandName(lhs);
    return ErrorConstructorName.$match(rhs.name, {
      Error: () => P.isNotUndefined(brand),
      TypeError: () => ErrorConstructorName.is.TypeError(brand),
      RangeError: () => ErrorConstructorName.is.RangeError(brand),
      SyntaxError: () => ErrorConstructorName.is.SyntaxError(brand),
      ReferenceError: () => ErrorConstructorName.is.ReferenceError(brand),
      EvalError: () => ErrorConstructorName.is.EvalError(brand),
      URIError: () => ErrorConstructorName.is.URIError(brand),
      AggregateError: () => ErrorConstructorName.is.AggregateError(brand),
    });
  }
  if (RuntimeReference.guards.GlobalNamespace(rhs)) {
    return GlobalNamespaceName.$match(rhs.name, {
      Date: () => CodeModeDate.is(lhs),
      RegExp: () => CodeModeRegExp.is(lhs),
      Map: () => CodeModeMap.is(lhs),
      Set: () => CodeModeSet.is(lhs),
      URL: () => CodeModeURL.is(lhs),
      URLSearchParams: () => CodeModeURLSearchParams.is(lhs),
      Array: () => A.isArray(lhs),
      Object: () => P.isNotNull(lhs) && (P.isObjectKeyword(lhs) || typeofValue(lhs) === "function"),
      Math: unsupported,
      JSON: unsupported,
      console: unsupported,
    });
  }
  if (RuntimeReference.guards.PromiseNamespace(rhs)) return CodeModePromise.is(lhs);
  if (RuntimeReference.guards.CoercionFunction(rhs)) {
    return CoercionFunctionName.$match(rhs.name, {
      Boolean: thunkFalse,
      Number: thunkFalse,
      String: thunkFalse,
      parseInt: unsupported,
      parseFloat: unsupported,
      isFinite: unsupported,
      isNaN: unsupported,
    });
  }
  return unsupported();
};

const collectPatternNames = (pattern: AstNode): Array<string> =>
  Match.value(pattern.type).pipe(
    Match.when("Identifier", () => [getString(pattern, "name")]),
    Match.when("AssignmentPattern", () => collectPatternNames(getNode(pattern, "left"))),
    Match.when("RestElement", () => collectPatternNames(getNode(pattern, "argument"))),
    Match.when("ArrayPattern", () =>
      A.flatMap(getArray(pattern, "elements"), (element) =>
        P.isNull(element) ? A.empty() : collectPatternNames(asNode(element, "elements"))
      )
    ),
    Match.when("ObjectPattern", () =>
      A.flatMap(getArray(pattern, "properties"), (property) => {
        const prop = asNode(property, "properties");
        return collectPatternNames(prop.type === "RestElement" ? getNode(prop, "argument") : getNode(prop, "value"));
      })
    ),
    Match.orElse(() => [])
  );

const collectHoistedVariables = (value: unknown): Array<readonly [name: string, node: AstNode]> => {
  if (A.isArray(value)) return A.flatMap(value, collectHoistedVariables);
  if (
    !AstNode.is(value) ||
    value.type === "FunctionDeclaration" ||
    value.type === "FunctionExpression" ||
    value.type === "ArrowFunctionExpression" ||
    value.type === "ClassDeclaration" ||
    value.type === "ClassExpression"
  ) {
    return A.empty();
  }
  if (value.type === "VariableDeclaration" && getString(value, "kind") === "var") {
    return A.flatMap(getArray(value, "declarations"), (declarationValue) => {
      const declaration = asNode(declarationValue, "declarations");
      return A.map(collectPatternNames(getNode(declaration, "id")), (name) => [name, declaration] as const);
    });
  }
  return A.flatMap(R.values(value), collectHoistedVariables);
};

const loopDeclaration = (left: AstNode, statement: "for...of" | "for...in") => {
  if (left.type !== "VariableDeclaration") return undefined;
  const declarations = getArray(left, "declarations");
  if (declarations.length !== 1) {
    throw InterpreterRuntimeError.new(`${statement} supports one declared binding.`, left);
  }
  const kind = getString(left, "kind");
  return {
    pattern: getNode(asNode(declarations[0], "declarations[0]"), "id"),
    mutable: kind !== "const",
    lexical: kind !== "var",
  };
};

type CustomIterator = {
  readonly iterator: SafeObject | CodeModeGenerator;
  readonly next: unknown;
  readonly asynchronous: boolean;
};

const OpaqueMemberReference = S.Union([
  ToolReference,
  PromiseMethodReference,
  PromiseInstanceMethodReference,
  IntrinsicReference,
  GlobalMethodReference,
  JsonMethodReference,
  GeneratorMethodReference,
]).pipe(S.toTaggedUnion("_tag"), SchemaUtils.withCodecStatics(["is"]));

type OpaqueMemberReference = typeof OpaqueMemberReference.Type;

const isDestructurableObject = (value: unknown): value is SafeObject | Array<unknown> =>
  A.isArray(value) || S.is(SafeObjectSchema)(value);

const copyIteratorSymbols = (
  source: object,
  target: object,
  consumed: O.Option<MutableHashSet.MutableHashSet<PropertyKey>> = O.none()
): void => {
  for (const symbol of IteratorSymbols) {
    if (!O.exists(consumed, (keys) => MutableHashSet.has(keys, symbol)) && P.hasProperty(source, symbol))
      Reflect.set(target, symbol, Reflect.get(source, symbol));
  }
};

type LoopLabels = MutableHashSet.MutableHashSet<string>;

const escapesLoopLabels = (label: O.Option<string>, labels: O.Option<LoopLabels>): boolean =>
  O.exists(label, (name) => !O.exists(labels, (names) => MutableHashSet.has(names, name)));

type GeneratorRequest = {
  readonly kind: GeneratorRequestKind;
  readonly value: unknown;
  readonly response: Deferred.Deferred<unknown, InterpreterFailure>;
};

type GeneratorState = {
  started: boolean;
  completed: boolean;
  draining: boolean;
  active: O.Option<GeneratorRequest>;
  pending: Array<GeneratorRequest>;
  pendingIndex: number;
  available: O.Option<Deferred.Deferred<void>>;
};

const promiseResolutionNode: AstNode = { type: "PromiseResolution" };

/**
 * Evaluates a {@link ProgramNode} against a fresh lexical frame and Promise runtime.
 *
 * **Gotchas**
 *
 * `run` pushes an extra scope frame so top-level declarations can shadow
 * builtins such as `Promise`. The implicit async body adopts a returned promise
 * before copy-out. `await` always suspends, including for plain values. Array,
 * Object, Date, and RegExp construct identically with or without `new`; Map,
 * Set, URL, and URLSearchParams require `new`; Math, JSON, and console are not
 * functions. Date-as-function formats ISO so the host timezone does not leak.
 * Tool-call promises fork at the call site so admission hooks run when the call
 * is made, and fiber exits make settlement idempotent.
 *
 * **Example** (Run a parsed literal program)
 *
 * ```ts
 * import { Effect, Scope } from "effect"
 * import * as S from "effect/Schema"
 * import { ProgramNode } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { PromiseRuntime } from "../../../codemode/interpreter/Interpreter.promises.ts"
 * import { Interpreter } from "../../../codemode/interpreter/Interpreter.runtime.ts"
 *
 * const program = S.decodeUnknownSync(ProgramNode)({
 *   type: "Program",
 *   body: [
 *     {
 *       type: "ExpressionStatement",
 *       expression: { type: "Literal", value: 2, raw: "2" },
 *     },
 *   ],
 * })
 *
 * const result = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const scope = yield* Scope.make()
 *     const interpreter = new Interpreter(
 *       () => Effect.succeed(undefined),
 *       () => Effect.succeed(undefined),
 *       () => [],
 *       new PromiseRuntime(scope),
 *     )
 *     return yield* interpreter.run(program)
 *   }),
 * )
 * console.log(result)
 * // 2
 * ```
 *
 * @see {@link executeWithLimits} for the supported host entry that parses, copies out, and applies budgets.
 * @see {@link ScopeStack} for TDZ, const assignment, and empty-stack throws.
 * @see {@link PromiseRuntime} for settlement, observation, and un-awaited rejection diagnostics.
 * @see {@link RuntimeReference} for the schema-owned handles `run` installs as builtins.
 * @see {@link GlobalNamespace} for constructor vs namespace call semantics.
 * @category services
 * @since 0.0.0
 */
export class Interpreter<R> {
  private scopes: ScopeStack;
  private readonly executeTool: (
    path: ReadonlyArray<string>,
    args: Array<unknown>
  ) => Effect.Effect<unknown, InterpreterFailure, R>;
  private readonly invokeSearch: (args: Array<unknown>) => Effect.Effect<unknown, InterpreterFailure, R>;
  private readonly toolKeys: (path: ReadonlyArray<string>) => ReadonlyArray<string>;
  private readonly logs: Array<string>;
  private readonly promises: PromiseRuntime<R>;
  private generatorState: O.Option<GeneratorState> = O.none();
  private generatorAsync = false;
  private readonly runner: CallbackRunner<R> & SyncIteratorRunner<R> = {
    invokeFunction: (fn, args) => this.invokeFunction(fn, args),
    invokeCallable: (callable, args, node) => this.invokeCallable(callable, args, node),
    settlePromise: (promise) => this.settlePromise(promise),
    syncIterator: (value, node) => this.syncIterator(value, node),
  };

  constructor(
    executeTool: (path: ReadonlyArray<string>, args: Array<unknown>) => Effect.Effect<unknown, InterpreterFailure, R>,
    invokeSearch: (args: Array<unknown>) => Effect.Effect<unknown, InterpreterFailure, R>,
    toolKeys: (path: ReadonlyArray<string>) => ReadonlyArray<string>,
    promises: PromiseRuntime<R>,
    logs = A.empty<string>()
  ) {
    const globalScope = MutableHashMap.empty<string, Binding>();
    this.scopes = ScopeStack.new([globalScope]);
    this.executeTool = executeTool;
    this.invokeSearch = invokeSearch;
    this.toolKeys = toolKeys;
    this.logs = logs;
    this.promises = promises;
    const globals: ReadonlyArray<readonly [string, unknown]> = [
      ["tools", ToolReference.new(A.empty())],
      ["search", SearchFunction.new()],
      ["Promise", PromiseNamespace.new()],
      ["Symbol", SymbolNamespace.new()],
      ["undefined", undefined],
      ["Object", GlobalNamespace.new("Object")],
      ["Math", GlobalNamespace.new("Math")],
      ["JSON", GlobalNamespace.new("JSON")],
      ["Number", CoercionFunction.new("Number")],
      ["String", CoercionFunction.new("String")],
      ["Boolean", CoercionFunction.new("Boolean")],
      ["Array", GlobalNamespace.new("Array")],
      ["console", GlobalNamespace.new("console")],
      ["parseInt", CoercionFunction.new("parseInt")],
      ["parseFloat", CoercionFunction.new("parseFloat")],
      ["isFinite", CoercionFunction.new("isFinite")],
      ["isNaN", CoercionFunction.new("isNaN")],
      ["Date", GlobalNamespace.new("Date")],
      ["RegExp", GlobalNamespace.new("RegExp")],
      ["Map", GlobalNamespace.new("Map")],
      ["Set", GlobalNamespace.new("Set")],
      ["URL", GlobalNamespace.new("URL")],
      ["URLSearchParams", GlobalNamespace.new("URLSearchParams")],
      ["encodeURI", UriFunction.new("encodeURI")],
      ["encodeURIComponent", UriFunction.new("encodeURIComponent")],
      ["decodeURI", UriFunction.new("decodeURI")],
      ["decodeURIComponent", UriFunction.new("decodeURIComponent")],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
    ];
    for (const [name, value] of globals) {
      MutableHashMap.set(globalScope, name, Binding.new(false, value));
    }
    for (const name of ErrorConstructorName.Options) {
      MutableHashMap.set(globalScope, name, Binding.new(false, ErrorConstructorReference.new(name)));
    }
  }

  /**
   * Evaluates a decoded {@link ProgramNode} in a fresh lexical frame, adopting a returned promise.
   *
   * **Example** (Run a parsed literal)
   *
   * ```ts
   * import { Effect, Scope } from "effect"
   * import * as S from "effect/Schema"
   * import { ProgramNode } from "../../../codemode/interpreter/Interpreter.model.ts"
   * import { PromiseRuntime } from "../../../codemode/interpreter/Interpreter.promises.ts"
   * import { Interpreter } from "../../../codemode/interpreter/Interpreter.runtime.ts"
   *
   * const program = S.decodeUnknownSync(ProgramNode)({
   *   type: "Program",
   *   body: [{ type: "ExpressionStatement", expression: { type: "Literal", value: 2, raw: "2" } }],
   * })
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const scope = yield* Scope.make()
   *     return yield* new Interpreter(
   *       () => Effect.succeed(undefined),
   *       () => Effect.succeed(undefined),
   *       () => [],
   *       new PromiseRuntime(scope),
   *     ).run(program)
   *   }),
   * )
   * console.log(result)
   * // 2
   * ```
   *
   * @since 0.0.0
   */
  run(program: ProgramNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const self = this;
    // Keep top-level declarations separate so they can shadow builtins.
    this.scopes.push();
    return Effect.gen(function* () {
      self.predeclareLexical(program.body);
      self.hoistFunctions(program.body);
      self.hoistVariables(program.body);
      let value: unknown;
      for (const [index, statement] of program.body.entries()) {
        if (index === program.body.length - 1 && statement.type === "ExpressionStatement") {
          value = yield* self.evaluateExpression(getNode(statement, "expression"));
          break;
        }
        const result = yield* self.evaluateStatement(statement);

        if (StatementResult.guards.Return(result)) {
          value = result.value;
          break;
        }

        if (StatementResult.isAnyOf(["Break", "Continue"])(result)) {
          throw InterpreterRuntimeError.new(`Unexpected '${result._tag.toLowerCase()}' outside of a loop.`, statement);
        }
      }

      // The implicit async body adopts returned promises before copy-out.
      value = yield* resolvePromiseValue(self.runner, value, program);
      return value;
    }).pipe(Effect.ensuring(Effect.sync(() => self.scopes.pop())));
  }

  /**
   * Forks a host tool call at the call site so admission hooks run when the guest invokes it.
   *
   * **Example** (Call a missing tool path)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return await tools.missing()")
   *   }),
   * )
   * console.log(result.ok === false)
   * // true
   * ```
   *
   * @since 0.0.0
   */
  // Fork at the call site so admission and hooks occur when the call is made.
  private createToolCallPromise(
    path: ReadonlyArray<string>,
    args: Array<unknown>
  ): Effect.Effect<CodeModePromise, never, R> {
    return this.createPromise(Effect.suspend(() => this.executeTool(path, args)));
  }

  /**
   * Registers a guest effect with {@link PromiseRuntime.create}.
   *
   * **Example** (Return an awaited promise)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return await Promise.resolve(3)")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 3
   * ```
   *
   * @since 0.0.0
   */
  private createPromise(
    effect: Effect.Effect<unknown, InterpreterFailure, R>
  ): Effect.Effect<CodeModePromise, never, R> {
    return this.promises.create(effect);
  }

  /**
   * Marks a guest promise observed, awaits its fiber, then yields so settlement is never inline.
   *
   * **Example** (Settle an awaited value)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return await 4")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 4
   * ```
   *
   * @since 0.0.0
   */
  // Fiber exits make settlement idempotent; yielding prevents inline continuation.
  private settlePromise(promise: CodeModePromise): Effect.Effect<unknown, InterpreterFailure> {
    const promises = this.promises;
    return Effect.suspend(() => {
      promises.markObserved(promise);
      return Effect.flatMap(promises.await(promise), (exit) => Effect.andThen(Effect.yieldNow, exit));
    });
  }

  /**
   * Dispatches one statement node, returning an abrupt {@link StatementResult} or {@link StatementNone}.
   *
   * **Example** (Evaluate an expression statement)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("5")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 5
   * ```
   *
   * @since 0.0.0
   */
  private evaluateStatement(node: AstNode): Effect.Effect<StatementResult, InterpreterFailure, R> {
    if (!S.is(StatementNodeType)(node.type)) {
      return Effect.fail(unsupportedSyntax(node.type, node));
    }
    return Match.value(node.type).pipe(
      Match.when("ExpressionStatement", () =>
        Effect.as(this.evaluateExpression(getNode(node, "expression")), StatementNone.new())
      ),
      Match.when("VariableDeclaration", () => Effect.as(this.evaluateVariableDeclaration(node), StatementNone.new())),
      Match.when("ReturnStatement", () => {
        const argumentNode = getOptionalNode(node, "argument");
        return P.isNotUndefined(argumentNode)
          ? Effect.map(this.evaluateExpression(argumentNode), StatementReturn.new)
          : Effect.succeed(StatementReturn.new(undefined));
      }),
      Match.when("BlockStatement", () => this.evaluateBlock(node)),
      Match.when("IfStatement", () => this.evaluateIfStatement(node)),
      Match.when("SwitchStatement", () => this.evaluateSwitchStatement(node)),
      Match.when("LabeledStatement", () => this.evaluateLabeledStatement(node)),
      Match.when("WhileStatement", () => this.evaluateWhileStatement(node)),
      Match.when("DoWhileStatement", () => this.evaluateDoWhileStatement(node)),
      Match.when("ForStatement", () => this.evaluateForStatement(node)),
      Match.when("ForOfStatement", () => this.evaluateForOfStatement(node)),
      Match.when("ForInStatement", () => this.evaluateForInStatement(node)),
      Match.when("BreakStatement", () => Effect.succeed(this.evaluateBreakStatement(node))),
      Match.when("ContinueStatement", () => Effect.succeed(this.evaluateContinueStatement(node))),
      Match.when("ThrowStatement", () => this.evaluateThrowStatement(node)),
      Match.when("TryStatement", () => this.evaluateTryStatement(node)),
      Match.when("EmptyStatement", () => Effect.succeed(StatementNone.new())),
      Match.when("FunctionDeclaration", () => Effect.succeed(StatementNone.new())),
      Match.exhaustive
    );
  }

  /**
   * Evaluates a block in a pushed scope, predeclaring lexicals and stopping on the first abrupt result.
   *
   * **Example** (Return from a nested block)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("{ const inner = 6; return inner }")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 6
   * ```
   *
   * @since 0.0.0
   */
  private evaluateBlock(node: AstNode): Effect.Effect<StatementResult, InterpreterFailure, R> {
    this.scopes.push();
    const self = this;
    return Effect.gen(function* () {
      const body = getArray(node, "body");
      self.predeclareLexical(body);
      self.hoistFunctions(body);

      for (const statementValue of body) {
        const statement = asNode(statementValue, "body");
        const result = yield* self.evaluateStatement(statement);

        if (!StatementResult.guards.None(result)) {
          return result;
        }
      }

      return StatementNone.new();
    }).pipe(Effect.ensuring(Effect.sync(() => self.scopes.pop())));
  }

  /**
   * Captures the current scope stack into a {@link CodeModeFunction} handle.
   *
   * **Example** (Call a captured arrow)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const add = (n) => n + 1; return add(7)")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 8
   * ```
   *
   * @since 0.0.0
   */
  private createFunction(node: AstNode): CodeModeFunction {
    return CodeModeFunction.new(
      getArray(node, "params").map((parameter, index) => asNode(parameter, `params[${index}]`)),
      getNode(node, "body"),
      this.scopes.capture(),
      node.async === true,
      node.generator === true
    );
  }

  /**
   * Declares function-declaration bindings in the current frame before statements run.
   *
   * **Example** (Call a hoisted function)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return answer(); function answer() { return 9 }")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 9
   * ```
   *
   * @since 0.0.0
   */
  private hoistFunctions(statements: ReadonlyArray<unknown>): void {
    for (const statementValue of statements) {
      if (!AstNode.is(statementValue) || statementValue.type !== "FunctionDeclaration") continue;
      const node = statementValue;
      this.scopes.declare(getString(getNode(node, "id"), "name"), this.createFunction(node), true, node);
    }
  }

  /**
   * Hoists `var` names into the current frame as initialized `undefined` slots.
   *
   * **Example** (Read a var declared later)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const before = value; var value = 10; return [before, value]")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // [undefined, 10]
   * ```
   *
   * @since 0.0.0
   */
  private hoistVariables(value: unknown): void {
    const scope = this.scopes.current();
    for (const [name, node] of collectHoistedVariables(value)) {
      if (!MutableHashMap.has(scope, name)) {
        this.scopes.declare(name, undefined, true, node);
      }
    }
  }

  /**
   * Reserves `let`/`const` names in the current frame so TDZ reads fail before initialize.
   *
   * **Example** (Read a let before initialization)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("try { return count } catch (error) { let count = 1; return error.name }")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // ReferenceError
   * ```
   *
   * @since 0.0.0
   */
  private predeclareLexical(statements: ReadonlyArray<unknown>): void {
    for (const statementValue of statements) {
      if (!AstNode.is(statementValue) || statementValue.type !== "VariableDeclaration") continue;
      const statement = statementValue;
      const kind = getString(statement, "kind");
      if (kind === "var") continue;
      for (const declarationValue of getArray(statement, "declarations")) {
        const declaration = asNode(declarationValue, "declarations");
        for (const name of collectPatternNames(getNode(declaration, "id"))) {
          this.scopes.reserve(name, kind !== "const", declaration);
        }
      }
    }
  }

  /**
   * Reserves every name in a binding pattern before the pattern is initialized.
   *
   * **Example** (Destructure a reserved let)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("let { n } = { n: 11 }; return n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 11
   * ```
   *
   * @since 0.0.0
   */
  private predeclarePattern(pattern: AstNode, mutable: boolean, node: AstNode): void {
    for (const name of collectPatternNames(pattern)) this.scopes.reserve(name, mutable, node);
  }

  /**
   * Evaluates an if statement using JavaScript truthiness, taking the else branch only when present.
   *
   * **Example** (Take the then branch)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("if (true) { return 12 } return 0")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 12
   * ```
   *
   * @since 0.0.0
   */
  private evaluateIfStatement(node: AstNode): Effect.Effect<StatementResult, InterpreterFailure, R> {
    const testNode = getNode(node, "test");
    const consequentNode = getNode(node, "consequent");
    const alternateNode = getOptionalNode(node, "alternate");

    return Effect.flatMap(this.evaluateExpression(testNode), (test) =>
      P.isTruthy(test)
        ? this.evaluateStatement(consequentNode)
        : P.isNotNullish(alternateNode)
          ? this.evaluateStatement(alternateNode)
          : Effect.succeed(StatementNone.new())
    );
  }

  /**
   * Evaluates a switch against data-only discriminant and case values, falling through until `break`.
   *
   * **Example** (Match a case)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("switch (2) { case 1: return 0; case 2: return 13; default: return -1 }")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 13
   * ```
   *
   * @since 0.0.0
   */
  private evaluateSwitchStatement(node: AstNode): Effect.Effect<StatementResult, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      const discriminant = yield* self.evaluateExpression(getNode(node, "discriminant"));
      if (containsOpaqueReference(discriminant)) {
        throw InterpreterRuntimeError.new("Switch discriminants must be data values.", node, "InvalidDataValue");
      }
      self.scopes.push();
      return yield* Effect.gen(function* () {
        const cases = getArray(node, "cases").map((value, index) => asNode(value, `cases[${index}]`));
        self.predeclareLexical(cases.flatMap((branch) => getArray(branch, "consequent")));
        let defaultIndex: number | undefined;
        let selected: number | undefined;
        for (const [index, branch] of cases.entries()) {
          const test = getOptionalNode(branch, "test");
          if (P.isUndefined(test)) {
            defaultIndex = index;
            continue;
          }
          const candidate = yield* self.evaluateExpression(test);
          if (containsOpaqueReference(candidate)) {
            throw InterpreterRuntimeError.new("Switch case values must be data values.", test, "InvalidDataValue");
          }
          if (candidate === discriminant) {
            selected = index;
            break;
          }
        }
        const start = selected ?? defaultIndex;
        if (P.isUndefined(start)) return StatementNone.new();
        for (let index = start; index < cases.length; index += 1) {
          const matchedCase = cases[index];
          if (P.isUndefined(matchedCase)) {
            return yield* InterpreterRuntimeError.new("Switch case index is outside the decoded case list.", node);
          }
          for (const statementValue of getArray(matchedCase, "consequent")) {
            const result = yield* self.evaluateStatement(asNode(statementValue, "consequent"));
            if (StatementResult.guards.Break(result)) {
              if (O.isNone(result.label)) return StatementNone.new();
              return result;
            }
            if (StatementResult.isAnyOf(["Return", "Continue"])(result)) return result;
          }
        }
        return StatementNone.new();
      }).pipe(Effect.ensuring(Effect.sync(() => self.scopes.pop())));
    });
  }

  /**
   * Runs a while loop, honoring labeled `break`/`continue` against the supplied loop labels.
   *
   * **Example** (Count with while)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("let n = 0; while (n < 3) n += 1; return n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 3
   * ```
   *
   * @since 0.0.0
   */
  private evaluateWhileStatement(
    node: AstNode,
    labels: O.Option<LoopLabels> = O.none()
  ): Effect.Effect<StatementResult, InterpreterFailure, R> {
    const testNode = getNode(node, "test");
    const bodyNode = getNode(node, "body");

    const self = this;
    return Effect.gen(function* () {
      while (P.isTruthy(yield* self.evaluateExpression(testNode))) {
        const result = yield* self.evaluateStatement(bodyNode);

        if (StatementResult.guards.Continue(result)) {
          if (escapesLoopLabels(result.label, labels)) return result;
          continue;
        }

        if (StatementResult.guards.Break(result)) {
          if (escapesLoopLabels(result.label, labels)) return result;
          return StatementNone.new();
        }

        if (StatementResult.guards.Return(result)) {
          return result;
        }
      }

      return StatementNone.new();
    });
  }

  /**
   * Runs a do-while loop so the body executes once even when the test is already falsy.
   *
   * **Example** (Run the body once)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("let n = 0; do { n += 1 } while (false); return n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 1
   * ```
   *
   * @since 0.0.0
   */
  private evaluateDoWhileStatement(
    node: AstNode,
    labels: O.Option<LoopLabels> = O.none()
  ): Effect.Effect<StatementResult, InterpreterFailure, R> {
    const bodyNode = getNode(node, "body");
    const testNode = getNode(node, "test");

    const self = this;
    return Effect.gen(function* () {
      do {
        const result = yield* self.evaluateStatement(bodyNode);

        if (StatementResult.guards.Continue(result)) {
          if (escapesLoopLabels(result.label, labels)) return result;
          continue;
        }

        if (StatementResult.guards.Break(result)) {
          if (escapesLoopLabels(result.label, labels)) return result;
          return StatementNone.new();
        }

        if (StatementResult.guards.Return(result)) {
          return result;
        }
      } while (P.isTruthy(yield* self.evaluateExpression(testNode)));

      return StatementNone.new();
    });
  }

  /**
   * Runs a C-style for loop, cloning per-iteration `let` bindings so closures see the right slot.
   *
   * **Example** (Accumulate in a for loop)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("let sum = 0; for (let i = 0; i < 3; i += 1) sum += i; return sum")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 3
   * ```
   *
   * @since 0.0.0
   */
  private evaluateForStatement(
    node: AstNode,
    labels: O.Option<LoopLabels> = O.none()
  ): Effect.Effect<StatementResult, InterpreterFailure, R> {
    this.scopes.push();
    const self = this;
    return Effect.gen(function* () {
      const initNode = getOptionalNode(node, "init");
      const testNode = getOptionalNode(node, "test");
      const updateNode = getOptionalNode(node, "update");
      const bodyNode = getNode(node, "body");

      if (initNode?.type === "VariableDeclaration" && getString(initNode, "kind") !== "var") {
        self.predeclareLexical([initNode]);
      }

      if (P.isNotNullish(initNode)) {
        if (initNode.type === "VariableDeclaration") {
          yield* self.evaluateVariableDeclaration(initNode);
        } else {
          yield* self.evaluateExpression(initNode);
        }
      }

      const perIterationBindings =
        initNode?.type === "VariableDeclaration" && getString(initNode, "kind") !== "var"
          ? pipe(MutableHashMap.keys(self.scopes.current()), A.fromIterable)
          : A.empty<string>();

      const nextIteration = () => {
        if (A.isArrayEmpty(perIterationBindings)) return;
        const current = self.scopes.current();
        self.scopes.pop();
        self.scopes.push(
          pipe(
            perIterationBindings,
            A.map((name) =>
              pipe(
                MutableHashMap.get(current, name),
                O.map((binding) => [name, binding] as const)
              )
            ),
            A.getSomes,
            MutableHashMap.fromIterable
          )
        );
      };
      nextIteration();

      while (P.isNotUndefined(testNode) ? P.isTruthy(yield* self.evaluateExpression(testNode)) : true) {
        const result = yield* self.evaluateStatement(bodyNode);

        if (StatementResult.guards.Return(result)) {
          return result;
        }

        if (StatementResult.guards.Break(result)) {
          if (escapesLoopLabels(result.label, labels)) return result;
          return StatementNone.new();
        }

        if (StatementResult.guards.Continue(result) && escapesLoopLabels(result.label, labels)) return result;

        nextIteration();
        if (P.isNotNullish(updateNode)) {
          yield* self.evaluateExpression(updateNode);
        }

        if (StatementResult.guards.Continue(result)) {
        }
      }

      return StatementNone.new();
    }).pipe(Effect.ensuring(Effect.sync(() => self.scopes.pop())));
  }

  /**
   * Iterates `for...of` / `for await...of` over arrays, strings, Map/Set/URLSearchParams, or custom iterators.
   *
   * **Example** (Sum an array)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("let sum = 0; for (const n of [1, 2, 3]) sum += n; return sum")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 6
   * ```
   *
   * @since 0.0.0
   */
  private evaluateForOfStatement(
    node: AstNode,
    labels: O.Option<LoopLabels> = O.none()
  ): Effect.Effect<StatementResult, InterpreterFailure, R> {
    const awaiting = getBoolean(node, "await");
    const left = getNode(node, "left");
    const declared = loopDeclaration(left, "for...of");
    if (P.isNotNullish(declared) && declared.lexical) this.scopes.push();

    const self = this;
    return Effect.gen(function* () {
      if (P.isNotNullish(declared) && declared.lexical) {
        self.predeclarePattern(declared.pattern, declared.mutable, left);
      }
      const right = yield* self.evaluateExpression(getNode(node, "right"));
      const body = getNode(node, "body");

      const iteratorOption = yield* self.customIterator(right, node, awaiting);
      const cursor = O.isNone(iteratorOption) ? yield* self.syncIterator(right, node) : undefined;
      if (O.isNone(iteratorOption) && P.isUndefined(cursor)) {
        throw InterpreterRuntimeError.new(
          `${awaiting ? "for await...of" : "for...of"} requires an array, string, Map, Set, or URLSearchParams, or custom iterator value.`,
          node
        ).as("TypeError");
      }
      const close = () =>
        O.match(iteratorOption, {
          onNone: () =>
            awaiting ? Effect.andThen(cursor?.close ?? Effect.void, Effect.yieldNow) : (cursor?.close ?? Effect.void),
          onSome: (iterator) => self.closeIterator(iterator, node, awaiting),
        });

      let assignment: AstNode | undefined;

      if (
        left.type !== "VariableDeclaration" &&
        (left.type === "Identifier" ||
          left.type === "MemberExpression" ||
          left.type === "ArrayPattern" ||
          left.type === "ObjectPattern")
      ) {
        assignment = left;
      } else if (left.type !== "VariableDeclaration") {
        throw InterpreterRuntimeError.new("Unsupported for...of binding.", left);
      }

      const evaluateBody = Effect.fnUntraced(
        function* (value: unknown) {
          if (P.isNotNullish(declared) && declared.lexical) {
            self.scopes.push();
            self.predeclarePattern(declared.pattern, declared.mutable, left);
            yield* self.declarePattern(declared.pattern, value, declared.mutable, left, true);
          } else if (P.isNotNullish(declared)) {
            yield* self.assignPattern(declared.pattern, value, left);
          } else if (P.isNotNullish(assignment)) {
            yield* self.assignPattern(assignment, value, left);
          }
          return yield* self.evaluateStatement(body);
        },
        Effect.ensuring(
          Effect.sync(() => {
            if (P.isNotNullish(declared) && declared.lexical) self.scopes.pop();
          })
        )
      );

      while (true) {
        const current = O.isSome(iteratorOption)
          ? yield* self.nextIteratorResult(iteratorOption.value, node, awaiting)
          : yield* cursor?.next ?? Effect.fail(InterpreterRuntimeError.new("Iterator is unavailable.", node));
        const step = P.isTruthy(cursor && awaiting)
          ? {
              done: current.done,
              value: yield* self.awaitValue(current.value),
            }
          : current;
        if (step.done) return StatementNone.new();
        const bodyExit = yield* Effect.exit(evaluateBody(step.value));
        if (!Exit.isSuccess(bodyExit)) {
          // Process interruption must remain prompt; user cleanup cannot extend a timeout.
          if (!Cause.hasInterruptsOnly(bodyExit.cause)) {
            yield* Effect.exit(close());
          }
          return yield* Effect.failCause(bodyExit.cause);
        }
        const result = bodyExit.value;

        if (StatementResult.guards.Return(result)) {
          yield* close();
          return result;
        }

        if (StatementResult.guards.Break(result)) {
          yield* close();
          if (escapesLoopLabels(result.label, labels)) return result;
          return StatementNone.new();
        }

        if (StatementResult.guards.Continue(result) && escapesLoopLabels(result.label, labels)) {
          yield* close();
          return result;
        }
      }
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          if (P.isNotNullish(declared) && declared.lexical) self.scopes.pop();
        })
      )
    );
  }

  /**
   * Adopts a thenable or guest promise and settles it, including plain values via {@link resolvePromise}.
   *
   * **Example** (Await a plain number)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return await 14")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 14
   * ```
   *
   * @since 0.0.0
   */
  private awaitValue(
    value: unknown,
    node: AstNode = promiseResolutionNode
  ): Effect.Effect<unknown, InterpreterFailure, R> {
    return Effect.flatMap(resolvePromise(this.runner, this.promises, value, node), (promise) =>
      this.settlePromise(promise)
    );
  }

  /**
   * Awaits a value produced by a sync iterator during `for await...of`, closing the iterator on rejection.
   *
   * **Example** (for-await over an array)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const out = []; for await (const n of [15]) out.push(n); return out")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // [15]
   * ```
   *
   * @since 0.0.0
   */
  private awaitAsyncFromSyncValue(
    iterator: CustomIterator,
    value: unknown,
    node: AstNode,
    closeOnRejection: boolean
  ): Effect.Effect<unknown, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      const settled = yield* Effect.exit(self.awaitValue(value));
      if (Exit.isSuccess(settled)) return settled.value;
      if (closeOnRejection && !Cause.hasInterruptsOnly(settled.cause)) {
        yield* Effect.exit(self.closeIterator(iterator, node, false));
      }
      return yield* Effect.failCause(settled.cause);
    });
  }

  /**
   * Builds a synchronous cursor over arrays, strings, Map, Set, URLSearchParams, or a custom iterator.
   *
   * **Example** (Spread an array)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return [...[16, 17]]")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // [16, 17]
   * ```
   *
   * @since 0.0.0
   */
  private syncIterator(value: unknown, node: AstNode) {
    const iterator = A.isArray(value)
      ? value[Symbol.iterator]()
      : P.isString(value)
        ? value[Symbol.iterator]()
        : CodeModeMap.is(value)
          ? value.map.entries()
          : CodeModeSet.is(value)
            ? value.set.values()
            : CodeModeURLSearchParams.is(value)
              ? value.params.entries()
              : undefined;
    if (iterator !== undefined) {
      return Effect.succeed({
        next: Effect.sync(() => {
          const step = iterator.next();
          return { done: Boolean(step.done), value: step.value };
        }),
        close: Effect.void,
      });
    }
    return Effect.map(
      this.customIterator(value, node, false),
      O.match({
        onNone: () => undefined,
        onSome: (iterator) => ({
          next: this.nextIteratorResult(iterator, node, false),
          close: Effect.suspend(() => this.closeIterator(iterator, node, false)),
        }),
      })
    );
  }

  /**
   * Resolves a guest generator or object with `Symbol.iterator` / `Symbol.asyncIterator` into a cursor.
   *
   * **Example** (Iterate a generator)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("function* g() { yield 18 }; const it = g(); return it.next().value")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 18
   * ```
   *
   * @since 0.0.0
   */
  private customIterator(
    value: unknown,
    node: AstNode,
    allowAsync = true
  ): Effect.Effect<O.Option<CustomIterator>, InterpreterFailure, R> {
    if (CodeModeGenerator.is(value)) {
      if (value.asynchronous && !allowAsync) return Effect.succeedNone;
      return Effect.succeedSome({
    iterator: value,
    next: GeneratorMethodReference.new(value, "next"),
    asynchronous: value.asynchronous,
});
    }
    if (!isRecord(value) || isRuntimeReference(value)) return Effect.succeedNone;
    const asyncMethod = allowAsync ? Reflect.get(value, AsyncIteratorSymbol) : undefined;
    const method = asyncMethod ?? Reflect.get(value, IteratorSymbol);
    if (P.isUndefined(method) || P.isNull(method)) return Effect.succeedNone;
    return Effect.map(
      this.invokeCallable(this.requireIteratorMethod(method, "Iterator method", node), [], node),
      (iterator) => {
        const object = this.requireIterator(iterator, node);
        return O.some({
          iterator: object,
          next: CodeModeGenerator.is(object)
            ? GeneratorMethodReference.new(object, "next")
            : this.requireIteratorMethod(object.next, "Iterator next", node),
          asynchronous: asyncMethod !== undefined && asyncMethod !== null,
        });
      }
    );
  }

  /**
   * Advances a custom iterator, awaiting async `next()` results and wrapping sync values for `for await`.
   *
   * **Example** (Pull the next generator result)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("function* g() { yield 19; return 20 }; return g().next()")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * ```
   *
   * @since 0.0.0
   */
  private nextIteratorResult(iterator: CustomIterator, node: AstNode, awaiting: boolean) {
    const self = this;
    return Effect.gen(function* () {
      if (iterator.asynchronous) {
        const object = self.requireIteratorObject(
          yield* self.awaitValue(yield* self.invokeCallable(iterator.next, [], node)),
          "Iterator next() result",
          node
        );
        return { done: Boolean(object.done), value: object.value };
      }

      const called = yield* Effect.exit(self.invokeCallable(iterator.next, [], node));
      if (!Exit.isSuccess(called)) {
        if (awaiting) yield* Effect.yieldNow;
        return yield* Effect.failCause(called.cause);
      }
      const captured = yield* Effect.exit(
        Effect.sync(() => {
          const object = self.requireIteratorObject(called.value, "Iterator next() result", node);
          return { done: Boolean(object.done), value: object.value };
        })
      );
      if (!Exit.isSuccess(captured)) {
        if (awaiting) yield* Effect.yieldNow;
        return yield* Effect.failCause(captured.cause);
      }
      return {
        done: captured.value.done,
        value: awaiting
          ? yield* self.awaitAsyncFromSyncValue(iterator, captured.value.value, node, !captured.value.done)
          : captured.value.value,
      };
    });
  }

  /**
   * Invokes an iterator's `return` method when a loop exits early, awaiting async close when required.
   *
   * **Example** (Break out of for-of)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("let n = 0; for (const x of [1, 2, 3]) { n = x; break }; return n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 1
   * ```
   *
   * @since 0.0.0
   */
  private closeIterator(
    iterator: CustomIterator,
    node: AstNode,
    awaiting = true
  ): Effect.Effect<void, InterpreterFailure, R> {
    const close = CodeModeGenerator.is(iterator.iterator)
      ? GeneratorMethodReference.new(iterator.iterator, "return")
      : iterator.iterator.return;
    if (close === undefined || close === null)
      return iterator.asynchronous || !awaiting ? Effect.void : Effect.yieldNow;
    const self = this;
    return Effect.gen(function* () {
      const method = self.requireIteratorMethod(close, "Iterator return", node);
      if (iterator.asynchronous) {
        self.requireIteratorObject(
          yield* self.awaitValue(yield* self.invokeCallable(method, [], node)),
          "Iterator return() result",
          node
        );
        return;
      }

      const called = yield* Effect.exit(self.invokeCallable(method, [], node));
      if (!Exit.isSuccess(called)) {
        if (awaiting) yield* Effect.yieldNow;
        return yield* Effect.failCause(called.cause);
      }
      const captured = yield* Effect.exit(
        Effect.sync(() => self.requireIteratorObject(called.value, "Iterator return() result", node).value)
      );
      if (!Exit.isSuccess(captured)) {
        if (awaiting) yield* Effect.yieldNow;
        return yield* Effect.failCause(captured.cause);
      }
      if (awaiting) yield* self.awaitValue(captured.value);
    });
  }

  /**
   * Asserts that an iterator `next`/`return` result is a non-runtime data object.
   *
   * **Example** (Reject a non-object next result)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const it = { next: () => 1 }; for (const x of it) return x")
   *   }),
   * )
   * console.log(result.ok === false)
   * // true
   * ```
   *
   * @since 0.0.0
   */
  private requireIteratorObject(value: unknown, context: string, node: AstNode): SafeObject {
    if (S.is(SafeObjectSchema)(value) && !isRuntimeReference(value)) return value;
    throw InterpreterRuntimeError.new(`${context} must be an object.`, node).as("TypeError");
  }

  /**
   * Accepts a {@link CodeModeGenerator} or a data object as an iterator instance.
   *
   * **Example** (Use a generator as an iterator)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("function* g() { yield 21 }; let n = 0; for (const x of g()) n = x; return n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 21
   * ```
   *
   * @since 0.0.0
   */
  private requireIterator(value: unknown, node: AstNode): SafeObject | CodeModeGenerator {
    return CodeModeGenerator.is(value) ? value : this.requireIteratorObject(value, "Iterator method result", node);
  }

  /**
   * Asserts that an iterator method (`next`/`return`) is a function.
   *
   * **Example** (Reject a non-callable next)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("for (const x of { next: 1 }) return x")
   *   }),
   * )
   * console.log(result.ok === false)
   * // true
   * ```
   *
   * @since 0.0.0
   */
  private requireIteratorMethod(value: unknown, context: string, node: AstNode): unknown {
    if (typeofValue(value) === "function") return value;
    throw InterpreterRuntimeError.new(`${context} must be a function.`, node).as("TypeError");
  }

  /**
   * Lists enumerable string keys for objects, arrays, and tool namespaces; `null`/`undefined` yield `[]`.
   *
   * **Example** (for-in over an object)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const keys = []; for (const key in { a: 1 }) keys.push(key); return keys")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // ["a"]
   * ```
   *
   * @since 0.0.0
   */
  private enumerableKeys(value: unknown): Array<string> | undefined {
    if (P.isNullish(value)) return A.empty();
    if (ToolReference.is(value)) {
      return [...this.toolKeys(value.path)];
    }
    if (A.isArray(value)) {
      return R.keys(value as unknown as Readonly<Record<string, unknown>>);
    }
    if (P.isNotNull(value) && P.isObjectKeyword(value) && !isRuntimeReference(value)) {
      return R.keys(value);
    }
    return undefined;
  }

  /**
   * Iterates enumerable keys with `for...in`, treating nullish sources as empty.
   *
   * **Example** (Skip a null source)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("let n = 0; for (const key in null) n += 1; return n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 0
   * ```
   *
   * @since 0.0.0
   */
  private evaluateForInStatement(
    node: AstNode,
    labels: O.Option<LoopLabels> = O.none()
  ): Effect.Effect<StatementResult, InterpreterFailure, R> {
    const left = getNode(node, "left");
    const declared = loopDeclaration(left, "for...in");
    if (P.isNotNullish(declared) && declared.lexical) this.scopes.push();

    const self = this;
    return Effect.gen(function* () {
      if (P.isNotNullish(declared) && declared.lexical) {
        self.predeclarePattern(declared.pattern, declared.mutable, left);
      }
      const right = yield* self.evaluateExpression(getNode(node, "right"));
      const body = getNode(node, "body");

      const keys = self.enumerableKeys(right);
      if (keys === undefined) {
        throw InterpreterRuntimeError.new(
          "for...in requires a plain object, array, or tools reference. Use for...of for arrays/strings/Maps/Sets, or Object.keys(value) for a key list.",
          node
        );
      }

      let assignmentName: string | undefined;

      if (left.type === "Identifier") {
        assignmentName = getString(left, "name");
      } else if (left.type !== "VariableDeclaration") {
        throw InterpreterRuntimeError.new("Unsupported for...in binding.", left);
      }

      for (const key of keys) {
        const result = yield* Effect.gen(function* () {
          if (P.isNotNullish(declared) && declared.lexical) {
            self.scopes.push();
            self.predeclarePattern(declared.pattern, declared.mutable, left);
            yield* self.declarePattern(declared.pattern, key, declared.mutable, left, true);
          } else if (P.isNotNullish(declared)) {
            yield* self.assignPattern(declared.pattern, key, left);
          } else if (P.isNotUndefined(assignmentName)) {
            self.scopes.set(assignmentName, key, left);
          }
          return yield* self.evaluateStatement(body);
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              if (P.isNotNullish(declared) && declared.lexical) self.scopes.pop();
            })
          )
        );

        if (StatementResult.guards.Return(result)) {
          return result;
        }

        if (StatementResult.guards.Break(result)) {
          if (escapesLoopLabels(result.label, labels)) return result;
          return StatementNone.new();
        }

        if (StatementResult.guards.Continue(result)) {
          if (escapesLoopLabels(result.label, labels)) {
            return result;
          }
        }
      }

      return StatementNone.new();
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          if (P.isNotNullish(declared) && declared.lexical) self.scopes.pop();
        })
      )
    );
  }

  /**
   * Builds a labeled or unlabeled {@link StatementBreak} from a `break` statement.
   *
   * **Example** (Break a loop)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("let n = 0; for (;;) { n = 22; break }; return n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 22
   * ```
   *
   * @since 0.0.0
   */
  private evaluateBreakStatement(node: AstNode): StatementResult {
    const labelNode = getOptionalNode(node, "label");
    return StatementBreak.new(P.isNotNullish(labelNode) ? getString(labelNode, "name") : undefined);
  }

  /**
   * Builds a labeled or unlabeled {@link StatementContinue} from a `continue` statement.
   *
   * **Example** (Skip an iteration)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("let n = 0; for (const x of [1, 2]) { if (x === 1) continue; n = x }; return n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 2
   * ```
   *
   * @since 0.0.0
   */
  private evaluateContinueStatement(node: AstNode): StatementResult {
    const labelNode = getOptionalNode(node, "label");
    return StatementContinue.new(P.isNotNullish(labelNode) ? getString(labelNode, "name") : undefined);
  }

  /**
   * Evaluates a labeled statement, attaching the label to nested loops so labeled break/continue can escape.
   *
   * **Example** (Break an outer label)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("let n = 0; outer: for (;;) { for (;;) { n = 23; break outer } }; return n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 23
   * ```
   *
   * @since 0.0.0
   */
  private evaluateLabeledStatement(node: AstNode): Effect.Effect<StatementResult, InterpreterFailure, R> {
    const labels = MutableHashSet.empty<string>();
    let body = node;
    while (body.type === "LabeledStatement") {
      MutableHashSet.add(labels, getString(getNode(body, "label"), "name"));
      body = getNode(body, "body");
    }

    const evaluated = (() => {
      const loopLabels = O.some(labels);
      if (body.type === "WhileStatement") return this.evaluateWhileStatement(body, loopLabels);
      if (body.type === "DoWhileStatement") return this.evaluateDoWhileStatement(body, loopLabels);
      if (body.type === "ForStatement") return this.evaluateForStatement(body, loopLabels);
      if (body.type === "ForOfStatement") return this.evaluateForOfStatement(body, loopLabels);
      if (body.type === "ForInStatement") return this.evaluateForInStatement(body, loopLabels);
      return this.evaluateStatement(body);
    })();

    return Effect.map(evaluated, (result) =>
      StatementResult.guards.Break(result) && O.exists(result.label, (label) => MutableHashSet.has(labels, label))
        ? StatementNone.new()
        : result
    );
  }

  /**
   * Evaluates a `throw` argument and fails the guest program with {@link ProgramThrow}.
   *
   * **Example** (Catch a thrown string)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("try { throw \"boom\" } catch (error) { return error }")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // boom
   * ```
   *
   * @since 0.0.0
   */
  private evaluateThrowStatement(node: AstNode): Effect.Effect<StatementResult, InterpreterFailure, R> {
    const argument = getNode(node, "argument");
    return Effect.flatMap(this.evaluateExpression(argument), (value) => Effect.fail(ProgramThrow.new(value)));
  }

  /**
   * Runs try/catch/finally, converting guest throws into catch bindings and preferring abrupt finally results.
   *
   * **Example** (Recover in catch)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("try { throw 1 } catch (error) { return 24 }")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 24
   * ```
   *
   * @since 0.0.0
   */
  private evaluateTryStatement(node: AstNode): Effect.Effect<StatementResult, InterpreterFailure, R> {
    const body = getNode(node, "block");
    const handler = getOptionalNode(node, "handler");
    const finalizer = getOptionalNode(node, "finalizer");
    const self = this;

    const attempted = Effect.matchCauseEffect(this.evaluateStatement(body), {
      onFailure: Effect.fnUntraced(function* (cause) {
        const failure = Cause.squash(cause);
        const isGeneratorReturn = pipe(
          Result.try(() => InterpreterFailure.guards.GeneratorReturn(failure)),
          Result.getOrElse(thunkFalse)
        );
        if (cause.reasons.some(Cause.isInterruptReason) || isGeneratorReturn || P.isUndefined(handler)) {
          return yield* Effect.failCause(cause);
        }

        const caught = caughtErrorValue(failure);
        const parameter = getOptionalNode(handler, "param");
        self.scopes.push();
        return yield* Effect.gen(function* () {
          if (P.isNotNullish(parameter)) yield* self.declarePattern(parameter, caught, true, handler);
          return yield* self.evaluateStatement(getNode(handler, "body"));
        }).pipe(Effect.ensuring(Effect.sync(() => self.scopes.pop())));
      }),
      onSuccess: Effect.succeed,
    });

    if (P.isNullish(finalizer)) return attempted;

    const isAbrupt = StatementResult.isAnyOf(["Return", "Break", "Continue"]);

    return Effect.matchCauseEffect(attempted, {
      onFailure: (cause) =>
        cause.reasons.some(Cause.isInterruptReason)
          ? Effect.failCause(cause)
          : Effect.filterOrElse(this.evaluateStatement(finalizer), final => isAbrupt(final), final => Effect.failCause(cause)),
      onSuccess: (result) =>
        Effect.filterOrElse(this.evaluateStatement(finalizer), final => isAbrupt(final), final => Effect.succeed(result)),
    });
  }

  /**
   * Declares or initializes each binding in a `var`/`let`/`const` declaration.
   *
   * **Example** (Initialize a const)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const value = 25; return value")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 25
   * ```
   *
   * @since 0.0.0
   */
  private evaluateVariableDeclaration(node: AstNode): Effect.Effect<void, InterpreterFailure, R> {
    const kind = getString(node, "kind");
    const declarations = getArray(node, "declarations");
    const self = this;
    return Effect.gen(function* () {
      for (const declarationValue of declarations) {
        const declaration = asNode(declarationValue, "declarations");

        if (declaration.type !== "VariableDeclarator") {
          throw InterpreterRuntimeError.new("Unsupported variable declaration shape.", declaration);
        }

        const init = getOptionalNode(declaration, "init");
        const pattern = getNode(declaration, "id");
        if (kind === "var") {
          if (P.isNotNullish(init)) {
            yield* self.assignPattern(pattern, yield* self.evaluateExpression(init), declaration);
          }
          continue;
        }
        const value = P.isNotNullish(init) ? yield* self.evaluateExpression(init) : undefined;
        yield* self.declarePattern(pattern, value, kind !== "const", declaration, true);
      }
    });
  }

  /**
   * Walks a binding pattern, declaring or initializing names including object/array rest.
   *
   * **Example** (Destructure with a default)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const { n = 26 } = {}; return n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 26
   * ```
   *
   * @since 0.0.0
   */
  private declarePattern(
    pattern: AstNode,
    value: unknown,
    mutable: boolean,
    node: AstNode,
    initialize = false
  ): Effect.Effect<void, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      if (pattern.type === "Identifier") {
        const name = getString(pattern, "name");
        if (initialize) self.scopes.initialize(name, value, node);
        else self.scopes.declare(name, value, mutable, node);
        return;
      }

      if (pattern.type === "AssignmentPattern") {
        const resolved = value === undefined ? yield* self.evaluateExpression(getNode(pattern, "right")) : value;
        yield* self.declarePattern(getNode(pattern, "left"), resolved, mutable, node, initialize);
        return;
      }

      if (pattern.type === "ObjectPattern") {
        if (!isDestructurableObject(value) || isRuntimeReference(value)) {
          throw InterpreterRuntimeError.new(
            "Object destructuring requires a data object or array value.",
            pattern,
            "InvalidDataValue"
          );
        }

        const consumed = MutableHashSet.empty<PropertyKey>();
        for (const propertyValue of getArray(pattern, "properties")) {
          const property = asNode(propertyValue, "properties");

          if (property.type === "RestElement") {
            const rest = makeEmptySafeObject();
            for (const [key, item] of R.toEntries(value as unknown as Readonly<Record<string, unknown>>)) {
              if (!MutableHashSet.has(consumed, key) && !isBlockedMember(key)) Reflect.set(rest, key, item);
            }
            copyIteratorSymbols(value, rest, O.some(consumed));
            yield* self.declarePattern(getNode(property, "argument"), rest, mutable, property, initialize);
            continue;
          }

          const key = yield* self.destructuringPropertyKey(property);
          if (isBlockedMember(String(key))) {
            throw InterpreterRuntimeError.new(`Property '${String(key)}' is not available.`, property);
          }
          MutableHashSet.add(consumed, P.isSymbol(key) ? key : String(key));
          yield* self.declarePattern(
            getNode(property, "value"),
            self.destructuringPropertyValue(value, key),
            mutable,
            property,
            initialize
          );
        }
        return;
      }

      if (pattern.type === "ArrayPattern") {
        return yield* self.destructureArrayPattern(pattern, value, (target, item, context) =>
          self.declarePattern(target, item, mutable, context, initialize)
        );
      }

      throw InterpreterRuntimeError.new(`Unsupported binding pattern '${pattern.type}'.`, pattern);
    });
  }

  /**
   * Assigns into an existing pattern target: identifiers, members, and nested destructuring.
   *
   * **Example** (Assign through an array pattern)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("let a; let b; [a, b] = [27, 28]; return [a, b]")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // [27, 28]
   * ```
   *
   * @since 0.0.0
   */
  private assignPattern(pattern: AstNode, value: unknown, node: AstNode): Effect.Effect<void, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      if (pattern.type === "Identifier") {
        self.scopes.set(getString(pattern, "name"), value, pattern);
        return;
      }

      if (pattern.type === "MemberExpression") {
        yield* self.writeMember(pattern, value);
        return;
      }

      if (pattern.type === "AssignmentPattern") {
        const resolved = value === undefined ? yield* self.evaluateExpression(getNode(pattern, "right")) : value;
        yield* self.assignPattern(getNode(pattern, "left"), resolved, node);
        return;
      }

      if (pattern.type === "ObjectPattern") {
        if (!isDestructurableObject(value) || isRuntimeReference(value)) {
          throw InterpreterRuntimeError.new(
            "Object destructuring requires a data object or array value.",
            pattern,
            "InvalidDataValue"
          );
        }

        const source = value;
        const consumed = MutableHashSet.empty<PropertyKey>();
        for (const propertyValue of getArray(pattern, "properties")) {
          const property = asNode(propertyValue, "properties");
          if (property.type === "RestElement") {
            const rest = makeEmptySafeObject();
            for (const [key, item] of R.toEntries(source as unknown as Readonly<Record<string, unknown>>)) {
              if (!MutableHashSet.has(consumed, key) && !isBlockedMember(key)) Reflect.set(rest, key, item);
            }
            copyIteratorSymbols(source, rest, O.some(consumed));
            yield* self.assignPattern(getNode(property, "argument"), rest, property);
            continue;
          }
          const key = yield* self.destructuringPropertyKey(property);
          if (isBlockedMember(String(key))) {
            throw InterpreterRuntimeError.new(`Property '${String(key)}' is not available.`, property);
          }
          MutableHashSet.add(consumed, P.isSymbol(key) ? key : String(key));
          yield* self.assignPattern(getNode(property, "value"), self.destructuringPropertyValue(source, key), property);
        }
        return;
      }

      if (pattern.type === "ArrayPattern") {
        return yield* self.destructureArrayPattern(pattern, value, (target, item, context) =>
          self.assignPattern(target, item, context)
        );
      }

      throw InterpreterRuntimeError.new(`Unsupported assignment pattern '${pattern.type}'.`, node);
    });
  }

  /**
   * Walks an array pattern against a synchronous iterable, filling holes and rest elements.
   *
   * **Example** (Collect a rest tail)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const [head, ...tail] = [29, 30, 31]; return [head, tail]")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * ```
   *
   * @since 0.0.0
   */
  private destructureArrayPattern(
    pattern: AstNode,
    value: unknown,
    consume: (target: AstNode, value: unknown, context: AstNode) => Effect.Effect<void, InterpreterFailure, R>
  ): Effect.Effect<void, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      const cursor = yield* self.syncIterator(value, pattern);
      if (P.isUndefined(cursor)) {
        throw InterpreterRuntimeError.new("Array destructuring requires a supported iterable value.", pattern).as(
          "TypeError"
        );
      }
      let done = false;
      for (const [index, item] of getArray(pattern, "elements").entries()) {
        if (done) {
          if (P.isNull(item)) continue;
          const element = asNode(item, `elements[${index}]`);
          yield* consume(
            element.type === "RestElement" ? getNode(element, "argument") : element,
            element.type === "RestElement" ? [] : undefined,
            element
          );
          if (element.type === "RestElement") return;
          continue;
        }
        const step = yield* cursor.next;
        done = step.done;
        if (P.isNull(item)) continue;
        const element = asNode(item, `elements[${index}]`);
        if (element.type === "RestElement") {
          const rest = A.empty<unknown>();
          if (!step.done) rest.push(step.value);
          while (!done) {
            const next = yield* cursor.next;
            done = next.done;
            if (!done) rest.push(next.value);
          }
          yield* consume(getNode(element, "argument"), rest, element);
          return;
        }
        const consumed = consume(element, step.done ? undefined : step.value, pattern);
        yield* step.done ? consumed : preserveConsumerError(cursor, consumed);
      }
      if (!done) yield* cursor.close;
    });
  }

  /**
   * Resolves a destructuring property key, including computed keys.
   *
   * **Example** (Destructure a computed key)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const key = \"n\"; const { [key]: value } = { n: 32 }; return value")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 32
   * ```
   *
   * @since 0.0.0
   */
  private destructuringPropertyKey(property: AstNode): Effect.Effect<PropertyKey, InterpreterFailure, R> {
    if (property.type !== "Property" || getString(property, "kind") !== "init") {
      throw InterpreterRuntimeError.new("Unsupported object destructuring property.", property);
    }
    const keyNode = getNode(property, "key");
    if (getBoolean(property, "computed")) {
      return Effect.map(this.evaluateExpression(keyNode), (value) => this.toPropertyKey(value, keyNode));
    }
    return Effect.succeed(keyNode.type === "Identifier" ? getString(keyNode, "name") : String(keyNode.value));
  }

  /**
   * Reads one destructured property from a data object or array without walking the prototype.
   *
   * **Example** (Pick a named property)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const { n } = { n: 33 }; return n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 33
   * ```
   *
   * @since 0.0.0
   */
  private destructuringPropertyValue(source: SafeObject | Array<unknown>, key: PropertyKey): unknown {
    if (!A.isArray(source)) return Reflect.get(source, key);
    if (key === "length") return source.length;
    if (P.isNumber(key)) return source[key];
    if (R.has(source as unknown as Readonly<Record<string | symbol, unknown>>, key)) return Reflect.get(source, key);
    if (P.isString(key) && S.is(arrayMethods)(key)) {
      return IntrinsicReference.new(IntrinsicMethod.cases.Array.make({ receiver: source, name: key }));
    }
    return undefined;
  }

  /**
   * Dispatches one expression node, including literals, operators, calls, members, and constructors.
   *
   * **Example** (Evaluate a literal)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return 34")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 34
   * ```
   *
   * @since 0.0.0
   */
  private evaluateExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const nodeType = node.type;
    if (!S.is(ExpressionNodeType)(nodeType)) {
      return Effect.fail(unsupportedSyntax(nodeType, node));
    }
    if (nodeType === "ArrowFunctionExpression" || nodeType === "FunctionExpression") {
      return Effect.sync(() => this.createFunction(node));
    }
    return Match.value(nodeType).pipe(
      Match.when("Literal", () => {
        const regex = node.regex;
        if (isRecord(regex) && P.isString(regex.pattern)) {
          return Effect.fromResult(
            tryInterpreter(
              () => this.constructRegExp([regex.pattern, P.isString(regex.flags) ? regex.flags : ""], node),
              node
            )
          );
        }
        return Effect.fromResult(tryInterpreter(() => boundedData(node.value, "Literal"), node));
      }),
      Match.when("Identifier", () =>
        Effect.fromResult(tryInterpreter(() => this.scopes.get(getString(node, "name"), node), node))
      ),
      Match.when("BinaryExpression", () => this.evaluateBinaryExpression(node)),
      Match.when("LogicalExpression", () => this.evaluateLogicalExpression(node)),
      Match.when("UnaryExpression", () => this.evaluateUnaryExpression(node)),
      Match.when("AssignmentExpression", () => this.evaluateAssignmentExpression(node)),
      Match.when("SequenceExpression", () => {
        const self = this;
        return Effect.gen(function* () {
          let result: unknown;
          for (const expression of getArray(node, "expressions")) {
            result = yield* self.evaluateExpression(asNode(expression, "expressions"));
          }
          return result;
        });
      }),
      Match.when("CallExpression", () => this.evaluateCallExpression(node)),
      Match.when("MemberExpression", () => this.readMember(node)),
      Match.when("ChainExpression", () =>
        Effect.map(this.evaluateExpression(getNode(node, "expression")), (value) =>
          value === OptionalShortCircuit ? undefined : value
        )
      ),
      Match.when("ObjectExpression", () => this.evaluateObjectExpression(node)),
      Match.when("ArrayExpression", () => this.evaluateArrayExpression(node)),
      Match.when("TemplateLiteral", () => this.evaluateTemplateLiteral(node)),
      Match.when("ConditionalExpression", () => this.evaluateConditionalExpression(node)),
      Match.when("UpdateExpression", () => this.evaluateUpdateExpression(node)),
      Match.when("AwaitExpression", () =>
        // Await always suspends, including for plain values.
        Effect.flatMap(this.evaluateExpression(getNode(node, "argument")), (value) => this.awaitValue(value, node))
      ),
      Match.when("YieldExpression", () => this.evaluateYieldExpression(node)),
      Match.when("NewExpression", () => this.evaluateNewExpression(node)),
      Match.exhaustive
    );
  }

  /**
   * Constructs a supported builtin (`Promise`, errors, Array/Object/Date/Map/Set/URL`).
   *
   * **Example** (Construct a Set)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return Array.from(new Set([35, 35]))")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // [35]
   * ```
   *
   * @since 0.0.0
   */
  private evaluateNewExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const callee = getNode(node, "callee");
    if (callee.type !== "Identifier") {
      return Effect.fail(unsupportedSyntax("NewExpression", node));
    }
    const name = getString(callee, "name");
    const argNodes = getArray(node, "arguments");
    const self = this;
    if (name === "Promise") {
      return Effect.flatMap(this.evaluateCallArguments(argNodes), (args) =>
        constructPromise(self.runner, self.promises, args[0], node)
      );
    }
    if (S.is(ErrorConstructorName)(name)) {
      return Effect.flatMap(this.evaluateCallArguments(argNodes), (args) =>
        name === "AggregateError"
          ? constructAggregateErrorValue(self.runner, args, node)
          : Effect.succeed(constructErrorValue(name, args))
      );
    }
    // Array and Object construct identically with or without new, like JS.
    if (name === "Array") {
      return Effect.map(this.evaluateCallArguments(argNodes), (args) => self.constructArray(args, node));
    }
    if (name === "Object") {
      return Effect.map(this.evaluateCallArguments(argNodes), (args) => self.constructObject(args, node));
    }
    if (S.is(valueConstructors)(name)) {
      return Effect.gen(function* () {
        const args = yield* self.evaluateCallArguments(argNodes);
        return yield* valueConstructors.$match(name, {
          Date: () => self.constructDate(args, node),
          RegExp: () => Effect.fromResult(tryInterpreter(() => self.constructRegExp(args, node), node)),
          Map: () => self.constructMap(args[0], node),
          Set: () => self.constructSet(args[0], node),
          URL: () => Effect.fromResult(tryInterpreter(() => self.constructURL(args, node), node)),
          URLSearchParams: () => self.constructURLSearchParams(args[0], node),
        });
      });
    }
    return Effect.fail(unsupportedSyntax("NewExpression", node));
  }

  /**
   * Constructs an array from arguments, treating a single integer as a sparse length like JS.
   *
   * **Example** (Array from values)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return Array(36, 37)")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // [36, 37]
   * ```
   *
   * @since 0.0.0
   */
  private constructArray(args: Array<unknown>, node: AstNode): Array<unknown> {
    if (args.length !== 1) return [...args];
    const first = args[0];
    if (!P.isNumber(first)) return [first];
    if (!Number.isInteger(first) || first < 0 || first > 4294967295) {
      throw InterpreterRuntimeError.new("Invalid array length.", node).as("RangeError");
    }
    // Sparse like JS: Array(3) has holes, and combinator loops already skip them.
    return new Array(first);
  }

  /**
   * Constructs `{}` from nullish input, or returns an existing object; primitive wrappers are rejected.
   *
   * **Example** (Object with no arguments)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return Object.keys(Object())")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // []
   * ```
   *
   * @since 0.0.0
   */
  private constructObject(args: Array<unknown>, node: AstNode): unknown {
    const first = args[0];
    if (P.isNull(first) || P.isUndefined(first)) return {};
    if (P.isObjectKeyword(first)) return first;
    throw InterpreterRuntimeError.new(
      `Object(${typeof first}) wrapper objects are not supported; use the primitive value directly.`,
      node
    );
  }

  /**
   * Constructs a {@link CodeModeDate} from no args, a parseable value, or year/month components.
   *
   * **Example** (Date from an epoch millis)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return new Date(0).getTime()")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 0
   * ```
   *
   * @since 0.0.0
   */
  private constructDate(args: Array<unknown>, node: AstNode): Effect.Effect<CodeModeDate, InterpreterFailure, R> {
    if (A.isArrayEmpty(args)) {
      return DateTime.now.pipe(Effect.map((now) => CodeModeDate.new(DateTime.toEpochMillis(now))));
    }
    if (args.length === 1) {
      const arg = args[0];
      if (CodeModeDate.is(arg)) return Effect.succeed(CodeModeDate.new(arg.time));
      return Effect.map(this.toDatePrimitive(arg, node), (value) =>
        P.isString(value)
          ? CodeModeDate.new(
              pipe(
                DateTime.make(value),
                O.match({
                  onNone: () => Number.NaN,
                  onSome: DateTime.toEpochMillis,
                })
              )
            )
          : CodeModeDate.new(
              pipe(
                DateTime.make(coerceToNumber(value)),
                O.match({
                  onNone: () => Number.NaN,
                  onSome: DateTime.toEpochMillis,
                })
              )
            )
      );
    }
    const parts = args.map((arg) => coerceToNumber(arg));
    const year = Math.trunc(parts[0]);
    const month = Math.trunc(parts[1]);
    const time = pipe(
      DateTime.makeZoned(
        {
          year: year >= 0 && year <= 99 ? year + 1900 : year,
          month: month + 1,
          day: Math.trunc(parts[2] ?? 1),
          hour: Math.trunc(parts[3] ?? 0),
          minute: Math.trunc(parts[4] ?? 0),
          second: Math.trunc(parts[5] ?? 0),
          millisecond: Math.trunc(parts[6] ?? 0),
        },
        {
          timeZone: DateTime.zoneMakeLocal(),
          adjustForTimeZone: true,
        }
      ),
      O.match({
        onNone: () => Number.NaN,
        onSome: DateTime.toEpochMillis,
      })
    );
    return Effect.succeed(CodeModeDate.new(time));
  }

  /**
   * Coerces a Date constructor argument through `valueOf`/`toString` when the value is an object.
   *
   * **Example** (Parse a date string)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return new Date(\"1970-01-01T00:00:00.000Z\").getTime()")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 0
   * ```
   *
   * @since 0.0.0
   */
  private toDatePrimitive(value: unknown, node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    if (P.isNull(value) || (!P.isObjectKeyword(value) && !P.isFunction(value))) return Effect.succeed(value);
    const self = this;
    return Effect.gen(function* () {
      const valueOfMethod = Reflect.get(value, "valueOf");
      if (R.has(value as Readonly<Record<string, unknown>>, "valueOf") && typeofValue(valueOfMethod) === "function") {
        const result = yield* self.runner.invokeCallable(valueOfMethod, [], node);
        if (P.isNull(result) || (!P.isObjectKeyword(result) && !P.isFunction(result))) return result;
      }
      if (!R.has(value as Readonly<Record<string, unknown>>, "toString")) return coerceToString(value);
      const toStringMethod = Reflect.get(value, "toString");
      if (typeofValue(toStringMethod) === "function") {
        const result = yield* self.runner.invokeCallable(toStringMethod, [], node);
        if (P.isNull(result) || (!P.isObjectKeyword(result) && !P.isFunction(result))) return result;
      }
      throw InterpreterRuntimeError.new("Cannot convert object to primitive value.", node).as("TypeError");
    });
  }

  /**
   * Constructs a {@link CodeModeRegExp}, rejecting invalid patterns and flags with SyntaxError.
   *
   * **Example** (Test a constructed regex)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return new RegExp(\"a+\").test(\"aa\")")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // true
   * ```
   *
   * @since 0.0.0
   */
  private constructRegExp(args: Array<unknown>, node: AstNode): CodeModeRegExp {
    const first = args[0];
    const pattern = CodeModeRegExp.is(first) ? first.regex.source : P.isUndefined(first) ? "" : coerceToString(first);
    const flagsArg = args[1];
    if (P.isNotUndefined(flagsArg) && !P.isString(flagsArg)) {
      throw InterpreterRuntimeError.new(
        `RegExp flags must be a string of flag characters (e.g. "g", "gi"), not ${P.isNull(flagsArg) ? "null" : typeofValue(flagsArg)}.`,
        node
      ).as("SyntaxError");
    }
    const flags = flagsArg ?? (CodeModeRegExp.is(first) ? first.regex.flags : "");
    try {
      return CodeModeRegExp.new(pattern, flags);
    } catch (error) {
      const reason = regexFailureReason(error);
      throw InterpreterRuntimeError.new(
        /flag/i.test(reason)
          ? `new RegExp(...) received invalid flags ${encodeJson(flags)} (${reason}). Valid flags are d, g, i, m, s, u, v, and y.`
          : `new RegExp(...) received ${encodeJson(pattern)}, which is not a valid regular expression pattern (${reason}). ${escapeRegexHint}`,
        node
      ).as("SyntaxError");
    }
  }

  /**
   * Constructs a {@link CodeModeMap} from omitted input or an iterable of `[key, value]` pairs.
   *
   * **Example** (Read a Map value)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return new Map([[\"n\", 38]]).get(\"n\")")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 38
   * ```
   *
   * @since 0.0.0
   */
  private constructMap(init: unknown, node: AstNode): Effect.Effect<CodeModeMap, InterpreterFailure, R> {
    const target = CodeModeMap.new();
    if (P.isUndefined(init) || P.isNull(init)) return Effect.succeed(target);
    const self = this;
    return Effect.gen(function* () {
      const cursor = yield* self.syncIterator(init, node);
      if (P.isUndefined(cursor)) {
        throw InterpreterRuntimeError.new(
          "new Map(...) expects an iterable of [key, value] pairs or no argument.",
          node
        ).as("TypeError");
      }
      while (true) {
        const step = yield* cursor.next;
        if (step.done) return target;
        yield* preserveConsumerError(
          cursor,
          Effect.sync(() => {
            if ((!A.isArray(step.value) && !isRecord(step.value)) || isRuntimeReference(step.value)) {
              throw InterpreterRuntimeError.new("new Map(...) expects [key, value] pairs as entry objects.", node).as(
                "TypeError"
              );
            }
            target.map.set(Reflect.get(step.value, 0), Reflect.get(step.value, 1));
          })
        );
      }
    });
  }

  /**
   * Constructs a {@link CodeModeSet} from omitted input or a synchronous iterable.
   *
   * **Example** (Check Set membership)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return new Set([39]).has(39)")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // true
   * ```
   *
   * @since 0.0.0
   */
  private constructSet(init: unknown, node: AstNode): Effect.Effect<CodeModeSet, InterpreterFailure, R> {
    const target = CodeModeSet.new();
    if (P.isUndefined(init) || P.isNull(init)) return Effect.succeed(target);
    const self = this;
    return Effect.gen(function* () {
      const cursor = yield* self.syncIterator(init, node);
      if (P.isUndefined(cursor)) {
        throw InterpreterRuntimeError.new("new Set(...) expects a synchronous iterable or no argument.", node).as(
          "TypeError"
        );
      }
      while (true) {
        const step = yield* cursor.next;
        if (step.done) return target;
        target.set.add(step.value);
      }
    });
  }

  /**
   * Constructs a {@link CodeModeURL} from an input string and optional base, throwing TypeError on invalid URLs.
   *
   * **Example** (Read a URL pathname)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return new URL(\"https://example.com/x\").pathname")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // /x
   * ```
   *
   * @since 0.0.0
   */
  private constructURL(args: Array<unknown>, node: AstNode): CodeModeURL {
    if (A.isArrayEmpty(args)) {
      throw InterpreterRuntimeError.new("new URL(...) requires a URL string and an optional base URL.", node).as(
        "TypeError"
      );
    }
    const input = urlArgument(args[0], "new URL input");
    const base = args[1] === undefined ? undefined : urlArgument(args[1], "new URL base");
    try {
      return CodeModeURL.new(new URL(input, base));
    } catch {
      throw InterpreterRuntimeError.new(
        `new URL(...) received an invalid URL${base === undefined ? "" : " or base URL"}.`,
        node
      ).as("TypeError");
    }
  }

  /**
   * Constructs {@link CodeModeURLSearchParams} from a query string, data object, or iterable pairs.
   *
   * **Example** (Read a query parameter)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return new URLSearchParams(\"n=40\").get(\"n\")")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 40
   * ```
   *
   * @since 0.0.0
   */
  private constructURLSearchParams(
    init: unknown,
    node: AstNode
  ): Effect.Effect<CodeModeURLSearchParams, InterpreterFailure, R> {
    if (P.isUndefined(init)) return Effect.succeed(CodeModeURLSearchParams.new(new URLSearchParams()));
    if (CodeModeURLSearchParams.is(init)) {
      return Effect.succeed(CodeModeURLSearchParams.new(new URLSearchParams(init.params)));
    }
    if (P.isString(init)) return Effect.succeed(CodeModeURLSearchParams.new(new URLSearchParams(init)));
    if (P.isNull(init) || P.isNumber(init) || P.isBoolean(init)) {
      return Effect.succeed(CodeModeURLSearchParams.new(new URLSearchParams(coerceToString(init))));
    }
    const self = this;
    return Effect.gen(function* () {
      const cursor = yield* self.syncIterator(init, node);
      if (P.isNotUndefined(cursor)) {
        const entries: Array<Array<string>> = [];
        while (true) {
          const step = yield* cursor.next;
          if (step.done) {
            if (entries.some((entry) => entry.length !== 2)) {
              throw InterpreterRuntimeError.new(
                "new URLSearchParams(...) expects iterable [name, value] pairs.",
                node
              ).as("TypeError");
            }
            return CodeModeURLSearchParams.new(
              new URLSearchParams(entries.map((entry): [string, string] => [entry[0] ?? "", entry[1] ?? ""]))
            );
          }
          entries.push(yield* preserveConsumerError(cursor, self.readURLSearchParamsPair(step.value, node)));
        }
      }
      if (isRuntimeReference(init)) {
        throw InterpreterRuntimeError.new(
          "new URLSearchParams(...) expects a query string, data object, or synchronous iterable pairs.",
          node
        ).as("TypeError");
      }
      if (isCodeModeValue(init)) return CodeModeURLSearchParams.new(new URLSearchParams());
      const data = boundedData(init, "new URLSearchParams input");
      if (!P.isObjectKeyword(data)) {
        throw InterpreterRuntimeError.new(
          "new URLSearchParams(...) expects a query string, data object, iterable pairs, or URLSearchParams.",
          node
        ).as("TypeError");
      }
      return CodeModeURLSearchParams.new(
        new URLSearchParams(R.fromEntries(A.map(R.toEntries(data), ([key, value]) => [key, coerceToString(value)])))
      );
    });
  }

  /**
   * Reads one `[name, value]` pair while constructing URLSearchParams from an iterable.
   *
   * **Example** (Construct from pairs)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return new URLSearchParams([[\"n\", \"41\"]]).get(\"n\")")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 41
   * ```
   *
   * @since 0.0.0
   */
  private readURLSearchParamsPair(value: unknown, node: AstNode): Effect.Effect<Array<string>, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      const cursor = yield* self.syncIterator(value, node);
      if (P.isUndefined(cursor)) {
        throw InterpreterRuntimeError.new("new URLSearchParams(...) expects iterable [name, value] pairs.", node).as(
          "TypeError"
        );
      }
      const items: Array<string> = [];
      while (true) {
        const step = yield* cursor.next;
        if (step.done) return items;
        items.push(
          yield* preserveConsumerError(
            cursor,
            Effect.sync(() => uriArgument(step.value, "URLSearchParams pair value"))
          )
        );
      }
    });
  }

  /**
   * Evaluates a binary operator, treating `instanceof` specially and bounding other results as data.
   *
   * **Example** (Add two numbers)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return 20 + 22")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 42
   * ```
   *
   * @since 0.0.0
   */
  private evaluateBinaryExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const operator = getString(node, "operator");
    if (!S.is(BinaryOperator)(operator)) {
      return Effect.fail(InterpreterRuntimeError.new(`Unsupported binary operator '${operator}'.`, node));
    }
    const self = this;
    return Effect.gen(function* () {
      const lhs = yield* self.evaluateExpression(getNode(node, "left"));
      const rhs = yield* self.evaluateExpression(getNode(node, "right"));
      if (operator === "instanceof") return instanceofValue(lhs, rhs, node);
      return boundedData(self.applyBinaryOperator(operator, lhs, rhs, node), "Binary expression result");
    });
  }

  /**
   * Applies a data-only binary operator, coercing Date and object operands like the guest language.
   *
   * **Example** (Strict equality)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return 1 === 1")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // true
   * ```
   *
   * @since 0.0.0
   */
  private applyBinaryOperator(operator: AppliedBinaryOperator, lhs: unknown, rhs: unknown, node: AstNode): unknown {
    if (operator === "===") return lhs === rhs;
    if (operator === "!==") return lhs !== rhs;
    if (containsOpaqueReference(lhs) || containsOpaqueReference(rhs)) {
      throw InterpreterRuntimeError.new("Binary operators require data values.", node, "InvalidDataValue");
    }
    // Null-prototype data needs explicit primitive coercion; identity and `in` retain raw objects.
    // Dates use their default string hint for addition and loose equality, and epoch time elsewhere.
    const coerceOperand = (operand: unknown): unknown => {
      if (CodeModeDate.is(operand)) {
        return operator === "+" || operator === "==" || operator === "!=" ? coerceToString(operand) : operand.time;
      }
      return P.isObjectKeyword(operand) ? coerceToString(operand) : operand;
    };
    const bothObjects = P.isObjectKeyword(lhs) && P.isObjectKeyword(rhs);
    const l = coerceOperand(lhs);
    const r = coerceOperand(rhs);
    const numericLeft = (): number => coerceToNumber(l);
    const numericRight = (): number => coerceToNumber(r);
    const compare = (
      strings: (left: string, right: string) => boolean,
      numbers: (left: number, right: number) => boolean
    ): boolean => (P.isString(l) && P.isString(r) ? strings(l, r) : numbers(numericLeft(), numericRight()));
    return AppliedBinaryOperator.$match(operator, {
      "+": () =>
        P.isString(l) || P.isString(r) ? `${coerceToString(l)}${coerceToString(r)}` : numericLeft() + numericRight(),
      "-": () => numericLeft() - numericRight(),
      "*": () => numericLeft() * numericRight(),
      "/": () => numericLeft() / numericRight(),
      "%": () => numericLeft() % numericRight(),
      "**": () => numericLeft() ** numericRight(),
      // biome-ignore lint/suspicious/noDoubleEquals: This interpreter must preserve guest JavaScript abstract equality semantics.
      "==": () => (bothObjects ? lhs === rhs : l == r),
      // biome-ignore lint/suspicious/noDoubleEquals: This interpreter must preserve guest JavaScript abstract inequality semantics.
      "!=": () => (bothObjects ? lhs !== rhs : l != r),
      "===": () => lhs === rhs,
      "!==": () => lhs !== rhs,
      "<": () =>
        compare(
          (left, right) => left < right,
          (left, right) => left < right
        ),
      "<=": () =>
        compare(
          (left, right) => left <= right,
          (left, right) => left <= right
        ),
      ">": () =>
        compare(
          (left, right) => left > right,
          (left, right) => left > right
        ),
      ">=": () =>
        compare(
          (left, right) => left >= right,
          (left, right) => left >= right
        ),
      "&": () => numericLeft() & numericRight(),
      "|": () => numericLeft() | numericRight(),
      "^": () => numericLeft() ^ numericRight(),
      "<<": () => numericLeft() << numericRight(),
      ">>": () => numericLeft() >> numericRight(),
      ">>>": () => numericLeft() >>> numericRight(),
      in: () => {
        if (!P.isObjectKeyword(rhs)) {
          throw InterpreterRuntimeError.new("The 'in' operator requires a data object on the right-hand side.", node);
        }
        // Never expose properties inherited from host prototypes.
        const key = P.isSymbol(l) ? l : coerceToString(l);
        return R.has(rhs as Readonly<Record<string | symbol, unknown>>, key);
      },
    });
  }

  /**
   * Evaluates `&&`, `||`, and `??` with JavaScript short-circuiting.
   *
   * **Example** (Nullish coalescing)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return null ?? 43")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 43
   * ```
   *
   * @since 0.0.0
   */
  private evaluateLogicalExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const operator = getString(node, "operator");
    if (!S.is(LogicalOperator)(operator)) {
      return Effect.fail(InterpreterRuntimeError.new(`Unsupported logical operator '${operator}'.`, node));
    }
    return Effect.flatMap(this.evaluateExpression(getNode(node, "left")), (left) => {
      const right = () => this.evaluateExpression(getNode(node, "right"));
      return LogicalOperator.$match(operator, {
        "&&": () => (P.isTruthy(left) ? right() : Effect.succeed(left)),
        "||": () => (P.isTruthy(left) ? Effect.succeed(left) : right()),
        "??": () => (P.isNotNull(left) && P.isNotUndefined(left) ? Effect.succeed(left) : right()),
      });
    });
  }

  /**
   * Evaluates unary operators including `!`, `void`, `typeof`, `delete`, and numeric coercion.
   *
   * **Example** (Negate a boolean)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return !false")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // true
   * ```
   *
   * @since 0.0.0
   */
  private evaluateUnaryExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const operator = getString(node, "operator");
    const argument = getNode(node, "argument");
    if (!S.is(UnaryOperator)(operator)) {
      return Effect.fail(InterpreterRuntimeError.new(`Unsupported unary operator '${operator}'.`, node));
    }
    const numeric = (apply: (operand: number) => number): Effect.Effect<unknown, InterpreterFailure, R> =>
      Effect.map(this.evaluateExpression(argument), (value) => {
        if (containsOpaqueReference(value)) {
          throw InterpreterRuntimeError.new("Unary operators require data values.", node, "InvalidDataValue");
        }
        const operand = CodeModeDate.is(value)
          ? value.time
          : P.isNotNull(value) && P.isObjectKeyword(value)
            ? coerceToString(value)
            : value;
        return boundedData(apply(coerceToNumber(operand)), "Unary expression result");
      });
    return UnaryOperator.$match(operator, {
      delete: () => this.evaluateDeleteExpression(argument),
      typeof: () =>
        // Undeclared names short-circuit, but declared TDZ bindings must still throw.
        argument.type === "Identifier" && O.isNone(this.scopes.resolve(getString(argument, "name")))
          ? Effect.succeed("undefined")
          : Effect.map(this.evaluateExpression(argument), typeofValue),
      "!": () => Effect.map(this.evaluateExpression(argument), (value) => !P.isTruthy(value)),
      void: () => Effect.as(this.evaluateExpression(argument), undefined),
      "+": () => numeric((operand) => +operand),
      "-": () => numeric((operand) => -operand),
      "~": () => numeric((operand) => ~operand),
    });
  }

  /**
   * Evaluates `=`, compound assignment, and logical assignment into identifiers or members.
   *
   * **Example** (Assign to a let)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("let n; n = 44; return n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 44
   * ```
   *
   * @since 0.0.0
   */
  private evaluateAssignmentExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const left = getNode(node, "left");
    const operator = getString(node, "operator");
    if (!S.is(AssignmentOperator)(operator)) {
      return Effect.fail(InterpreterRuntimeError.new(`Unsupported assignment operator '${operator}'.`, node));
    }
    const self = this;
    return Effect.gen(function* () {
      if (S.is(LogicalAssignmentOperator)(operator)) {
        return yield* self.evaluateLogicalAssignment(node, left, operator);
      }
      if (operator === "=" && (left.type === "ObjectPattern" || left.type === "ArrayPattern")) {
        const rightValue = yield* self.evaluateExpression(getNode(node, "right"));
        yield* self.assignPattern(left, rightValue, node);
        return rightValue;
      }
      if (left.type === "Identifier") {
        const name = getString(left, "name");
        if (operator !== "=") {
          const current = self.scopes.get(name, left);
          const rightValue = yield* self.evaluateExpression(getNode(node, "right"));
          const next = boundedData(
            self.applyCompoundAssignment(operator, current, rightValue, node),
            "Assignment result"
          );
          return self.scopes.set(name, next, left);
        }
        const rightValue = yield* self.evaluateExpression(getNode(node, "right"));
        return self.scopes.set(name, rightValue, left);
      }
      if (left.type === "MemberExpression") {
        return yield* self.modifyMember(left, (current) =>
          Effect.map(self.evaluateExpression(getNode(node, "right")), (rightValue) => {
            if (operator === "=")
              return {
                write: true,
                next: rightValue,
                result: rightValue,
              };
            const next = boundedData(
              self.applyCompoundAssignment(operator, current, rightValue, node),
              "Assignment result"
            );
            return { write: true, next, result: next };
          })
        );
      }
      throw InterpreterRuntimeError.new("Assignment target must be an Identifier or MemberExpression.", left);
    });
  }

  /**
   * Applies `&&=`, `||=`, or `??=`, writing only when the current value should be replaced.
   *
   * **Example** (Logical or-assign)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("let n = 0; n ||= 45; return n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 45
   * ```
   *
   * @since 0.0.0
   */
  private evaluateLogicalAssignment(
    node: AstNode,
    left: AstNode,
    operator: LogicalAssignmentOperator
  ): Effect.Effect<unknown, InterpreterFailure, R> {
    const self = this;
    const shouldAssign = (current: unknown): boolean =>
      LogicalAssignmentOperator.$match(operator, {
        "??=": () => P.isNull(current) || P.isUndefined(current),
        "||=": () => !P.isTruthy(current),
        "&&=": () => P.isTruthy(current),
      });
    if (left.type === "Identifier") {
      const name = getString(left, "name");
      return Effect.gen(function* () {
        const current = self.scopes.get(name, left);
        if (!shouldAssign(current)) return current;
        const rightValue = yield* self.evaluateExpression(getNode(node, "right"));
        return self.scopes.set(name, rightValue, left);
      });
    }
    if (left.type === "MemberExpression") {
      return self.modifyMember(left, (current) =>
        shouldAssign(current)
          ? Effect.map(self.evaluateExpression(getNode(node, "right")), (rightValue) => ({
              write: true,
              next: rightValue,
              result: rightValue,
            }))
          : Effect.succeed({ write: false, next: current, result: current })
      );
    }
    throw InterpreterRuntimeError.new("Assignment target must be an Identifier or MemberExpression.", left);
  }

  /**
   * Applies prefix/postfix `++`/`--` to identifiers and members.
   *
   * **Example** (Postfix increment)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("let n = 45; n++; return n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 46
   * ```
   *
   * @since 0.0.0
   */
  private evaluateUpdateExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const operator = getString(node, "operator");
    const argument = getNode(node, "argument");
    const prefix = getBoolean(node, "prefix");
    if (!S.is(UpdateOperator.To)(operator)) {
      return Effect.fail(InterpreterRuntimeError.new(`Unsupported update operator '${operator}'.`, node));
    }
    const increment = UpdateOperator.Enum[operator];

    // CodeMode numeric coercion, not host Number(): null-prototype data objects would make
    // the host throw during ToPrimitive, and opaque runtime references must reject clearly.
    const operand = (current: unknown): number => {
      if (containsOpaqueReference(current)) {
        throw InterpreterRuntimeError.new(`'${operator}' requires a data value.`, argument, "InvalidDataValue");
      }
      return coerceToNumber(current);
    };

    if (argument.type === "Identifier") {
      return Effect.sync(() => {
        const name = getString(argument, "name");
        const current = operand(this.scopes.get(name, argument));
        const next = current + increment;
        this.scopes.set(name, next, argument);
        return prefix ? next : current;
      });
    }

    if (argument.type === "MemberExpression") {
      return this.modifyMember(argument, (current) => {
        const value = operand(current);
        const next = value + increment;
        return Effect.succeed({
          write: true,
          next,
          result: prefix ? next : value,
        });
      });
    }

    throw InterpreterRuntimeError.new("Update target must be an Identifier or MemberExpression.", argument);
  }

  /**
   * Evaluates a call expression, short-circuiting optional calls when the callee is nullish.
   *
   * **Example** (Call Number)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return Number(\"47\")")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 47
   * ```
   *
   * @since 0.0.0
   */
  private evaluateCallExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const callee = getNode(node, "callee");
    const argNodes = getArray(node, "arguments");

    const self = this;
    return Effect.gen(function* () {
      const callable = yield* self.evaluateExpression(callee);
      if (callable === OptionalShortCircuit) return OptionalShortCircuit;
      if ((callable === null || callable === undefined) && node.optional === true) return OptionalShortCircuit;

      const args = yield* self.evaluateCallArguments(argNodes);
      return yield* self.invokeCallable(callable, args, node, callee);
    });
  }

  /**
   * Dispatches every guest invocation: tools, promises, functions, globals, coercions, and constructors.
   *
   * **Example** (Call Math.abs)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return Math.abs(-48)")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 48
   * ```
   *
   * @since 0.0.0
   */
  // The single dispatch for every invocation: call expressions and callbacks share it.
  private invokeCallable(
    callable: unknown,
    args: Array<unknown>,
    node: AstNode,
    callee: AstNode = node
  ): Effect.Effect<unknown, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      if (ToolReference.is(callable)) {
        if (callable.path.length === 0) throw InterpreterRuntimeError.new("The tools root is not callable.", callee);
        return yield* self.createToolCallPromise(callable.path, args);
      }
      if (RuntimeReference.guards.PromiseMethodReference(callable)) {
        return yield* invokePromiseMethod(self.runner, self.promises, callable, args, node);
      }
      if (RuntimeReference.guards.PromiseInstanceMethodReference(callable)) {
        return yield* invokePromiseInstanceMethod(self.runner, self.promises, callable, args, node);
      }
      if (RuntimeReference.guards.CodeModeFunction(callable)) {
        return yield* self.invokeFunction(callable, args);
      }
      if (RuntimeReference.guards.GeneratorMethodReference(callable)) {
        const request = (
          generator: CodeModeGenerator,
          kind: GeneratorRequestKind
        ): Effect.Effect<unknown, InterpreterFailure, R> => {
          const requested = generator.request(kind, args[0], node);
          return generator.asynchronous ? self.createPromise(requested) : requested;
        };

        return yield* GeneratorMethodKind.$match(callable.kind, {
          iterator: () => Effect.succeed(callable.generator),
          next: () => request(callable.generator, "next"),
          return: () => request(callable.generator, "return"),
          throw: () => request(callable.generator, "throw"),
        });
      }
      if (RuntimeReference.guards.IntrinsicReference(callable)) {
        return yield* invokeIntrinsic(self.runner, callable, args, node);
      }
      if (RuntimeReference.guards.GlobalMethodReference(callable)) {
        const invokeBounded = (reference: GlobalMethodReference): Effect.Effect<unknown, InterpreterFailure> =>
          Effect.fromResult(
            tryInterpreter(
              () =>
                boundedData(
                  invokeGlobalMethod(reference, args, node),
                  `${reference.method.namespace}.${reference.method.name} result`
                ),
              node
            )
          );

        return yield* GlobalMethod.match(callable.method, {
          console: ({ name }) => Effect.fromResult(tryInterpreter(() => self.invokeConsole(name, args, node), node)),
          Object: ({ name }) => {
            if (ToolReference.is(args[0])) {
              const reference = args[0];
              return Effect.fromResult(
                tryInterpreter(() => self.invokeObjectMethodOnTools(name, reference, node), node)
              );
            }
            if (S.is(objectMethodsPreservingIdentity)(name)) {
              return name === "fromEntries"
                ? invokeObjectFromEntries(self.runner, args[0], node)
                : Effect.fromResult(tryInterpreter(() => invokeGlobalMethod(callable, args, node), node));
            }
            return name === "groupBy" ? invokeGroupBy(self.runner, "Object", args, node) : invokeBounded(callable);
          },
          Math: ({ name }) => {
            if (name === "random") return Random.next;
            return name === "sumPrecise" ? invokeMathSumPrecise(self.runner, args[0], node) : invokeBounded(callable);
          },
          Array: ({ name }) => {
            if (name === "from") return invokeArrayFrom(self.runner, args, node);
            return name === "of"
              ? Effect.fromResult(tryInterpreter(() => invokeGlobalMethod(callable, args, node), node))
              : invokeBounded(callable);
          },
          Map: ({ name }) =>
            name === "groupBy" ? invokeGroupBy(self.runner, "Map", args, node) : invokeBounded(callable),
          Date: ({ name }) =>
            name === "now" ? Effect.map(DateTime.now, DateTime.toEpochMillis) : invokeBounded(callable),
          RegExp: () => invokeBounded(callable),
          URL: () => invokeBounded(callable),
          Number: () => invokeBounded(callable),
          String: () => invokeBounded(callable),
        });
      }
      if (RuntimeReference.guards.JsonMethodReference(callable)) {
        return yield* invokeJsonMethod(self.runner, callable, args, node);
      }
      if (RuntimeReference.guards.CoercionFunction(callable)) {
        return boundedData(invokeCoercion(callable, args, node), `${callable.name} result`);
      }
      if (RuntimeReference.guards.UriFunction(callable)) {
        return yield* Effect.fromResult(invokeUriFunction(callable, args, node));
      }
      if (RuntimeReference.guards.SearchFunction(callable)) {
        return yield* self.invokeSearch(args);
      }
      if (RuntimeReference.guards.ErrorConstructorReference(callable)) {
        const construct = () => Effect.succeed(constructErrorValue(callable.name, args));

        return yield* ErrorConstructorName.$match(callable.name, {
          Error: construct,
          TypeError: construct,
          RangeError: construct,
          SyntaxError: construct,
          ReferenceError: construct,
          EvalError: construct,
          URIError: construct,
          AggregateError: () => constructAggregateErrorValue(self.runner, args, node),
        });
      }
      if (RuntimeReference.guards.GlobalNamespace(callable)) {
        const requiresNew = (name: string): Effect.Effect<never, InterpreterFailure> =>
          Effect.fail(InterpreterRuntimeError.new(`Constructor ${name} requires 'new'.`, node).as("TypeError"));
        const notFunction = (name: string): Effect.Effect<never, InterpreterFailure> =>
          Effect.fail(InterpreterRuntimeError.new(`${name} is not a function.`, node).as("TypeError"));

        return yield* GlobalNamespaceName.$match(callable.name, {
          // Real JS permits calling Array, Object, Date, and RegExp without new.
          Array: () => Effect.succeed(self.constructArray(args, node)),
          Object: () => Effect.succeed(self.constructObject(args, node)),
          // ISO instead of the host's locale string: CodeMode date strings are
          // deterministic and must not leak the host timezone.
          Date: () => Effect.map(DateTime.now, DateTime.formatIso),
          RegExp: () => Effect.fromResult(tryInterpreter(() => self.constructRegExp(args, node), node)),
          Map: () => requiresNew(callable.name),
          Set: () => requiresNew(callable.name),
          URL: () => requiresNew(callable.name),
          URLSearchParams: () => requiresNew(callable.name),
          Math: () => notFunction(callable.name),
          JSON: () => notFunction(callable.name),
          console: () => notFunction(callable.name),
        });
      }
      if (RuntimeReference.guards.PromiseNamespace(callable)) {
        throw InterpreterRuntimeError.new("Constructor Promise requires 'new'.", node).as("TypeError");
      }
      if (RuntimeReference.guards.SymbolNamespace(callable)) {
        throw InterpreterRuntimeError.new(
          "Symbol is not callable; only Symbol.asyncIterator and Symbol.iterator are available.",
          node
        ).as("TypeError");
      }
      if (RuntimeReference.guards.PromiseCapabilityFunction(callable)) {
        callable.settle(args[0]);
        return undefined;
      }
      if (callable === undefined || callable === null) {
        throw InterpreterRuntimeError.new(`${calleeDescription(callee)} is not a function.`, callee).as("TypeError");
      }
      throw InterpreterRuntimeError.new("Only tools are callable here.", callee);
    });
  }

  /**
   * Allows `Object.keys` on tool namespaces and rejects other Object methods against opaque tool handles.
   *
   * **Example** (List tool keys)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return Object.keys(tools)")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // []
   * ```
   *
   * @since 0.0.0
   */
  private invokeObjectMethodOnTools(name: string, ref: ToolReference, node: AstNode): unknown {
    if (name === "keys") {
      const keys = this.enumerableKeys(ref);
      if (P.isUndefined(keys)) {
        throw InterpreterRuntimeError.new(
          "Object.keys could not enumerate this runtime reference.",
          node,
          "InvalidDataValue"
        );
      }
      return boundedData(keys, "Object.keys result");
    }
    throw InterpreterRuntimeError.new(
      `Object.${name}(...) cannot read tool references: they are not plain data. Use Object.keys(tools) for names, or search({ query }) for signatures.`,
      node,
      "InvalidDataValue"
    );
  }

  /**
   * Captures `console.log`/`warn`/`error`/`dir`/`table` into the execution log list.
   *
   * **Example** (Capture a log line)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("console.log(\"hi\"); return 1")
   *   }),
   * )
   * console.log(result.ok === true ? result.logs : result)
   * ```
   *
   * @since 0.0.0
   */
  private invokeConsole(name: ConsoleMethod, args: Array<unknown>, _node: AstNode): undefined {
    this.logs.push(formatConsoleMessage(name, args));
    return undefined;
  }

  /**
   * Evaluates call arguments, expanding spread elements through a synchronous iterator.
   *
   * **Example** (Spread into Math.max)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return Math.max(...[1, 49])")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 49
   * ```
   *
   * @since 0.0.0
   */
  private evaluateCallArguments(argNodes: Array<unknown>): Effect.Effect<Array<unknown>, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      const args = A.empty<unknown>();
      for (const [index, arg] of argNodes.entries()) {
        const argNode = asNode(arg, `arguments[${index}]`);
        if (argNode.type === "SpreadElement") {
          const spread = yield* self.evaluateExpression(getNode(argNode, "argument"));
          const cursor = yield* self.syncIterator(spread, argNode);
          if (P.isUndefined(cursor))
            throw InterpreterRuntimeError.new("Spread arguments require a synchronous iterable.", argNode).as(
              "TypeError"
            );
          while (true) {
            const step = yield* cursor.next;
            if (step.done) break;
            args.push(step.value);
          }
        } else {
          args.push(yield* self.evaluateExpression(argNode));
        }
      }
      return args;
    });
  }

  /**
   * Invokes a guest function in a captured-scope frame, wrapping async bodies in a guest promise.
   *
   * **Example** (Call an arrow with rest)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const sum = (...ns) => ns[0] + ns[1]; return sum(20, 30)")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 50
   * ```
   *
   * @since 0.0.0
   */
  private invokeFunction(fn: CodeModeFunction, args: Array<unknown>): Effect.Effect<unknown, InterpreterFailure, R> {
    const invocation = new Interpreter(this.executeTool, this.invokeSearch, this.toolKeys, this.promises, this.logs);
    invocation.scopes = ScopeStack.new(A.append(fn.capturedScopes, MutableHashMap.empty()));
    const run = Effect.gen(function* () {
      // Seed all parameters first so defaults cannot fall through to same-named outer bindings.
      const paramScope = invocation.scopes.current();
      for (const parameter of fn.parameters) {
        for (const name of collectPatternNames(parameter)) {
          MutableHashMap.set(paramScope, name, Binding.new(true, undefined, false));
        }
      }
      for (const [index, parameter] of fn.parameters.entries()) {
        if (parameter.type === "RestElement") {
          yield* invocation.declarePattern(getNode(parameter, "argument"), args.slice(index), true, parameter, true);
          break;
        }
        yield* invocation.declarePattern(parameter, args[index], true, parameter, true);
      }

      if (fn.body.type === "BlockStatement") {
        invocation.hoistVariables(getArray(fn.body, "body"));
        const result = yield* invocation.evaluateStatement(fn.body);
        return StatementResult.guards.Return(result) ? result.value : undefined;
      }

      return yield* invocation.evaluateExpression(fn.body);
    });
    if (fn.generator) {
      return Effect.map(Effect.context<R>(), (context) => this.createGenerator(invocation, run, fn.async, context));
    }
    if (!fn.async) return run;
    // The initial yield assigns the promise before the body can self-resolve.
    const identity = MutableRef.make<O.Option<CodeModePromise>>(O.none());
    return Effect.map(
      this.createPromise(
        Effect.flatMap(run, (value) => resolvePromiseValue(invocation.runner, value, fn.body, O.some(identity)))
      ),
      (promise) => {
        MutableRef.set(identity, O.some(promise));
        return promise;
      }
    );
  }

  /**
   * Builds a {@link CodeModeGenerator} that queues `next`/`return`/`throw` against a function body fiber.
   *
   * **Example** (Pull from a generator)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("function* g() { yield 51 }; return g().next().value")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 51
   * ```
   *
   * @since 0.0.0
   */
  private createGenerator(
    invocation: Interpreter<R>,
    run: Effect.Effect<unknown, InterpreterFailure, R>,
    asynchronous: boolean,
    context: Context.Context<R>
  ): CodeModeGenerator {
    const state: GeneratorState = {
      started: false,
      completed: false,
      draining: false,
      active: O.none(),
      pending: A.empty(),
      pendingIndex: 0,
      available: O.none(),
    };
    invocation.generatorState = O.some(state);
    invocation.generatorAsync = asynchronous;
    const requestGenerator = (
      kind: GeneratorRequestKind,
      value: unknown,
      node: AstNode
    ): Effect.Effect<unknown, InterpreterFailure, R> => {
      const request = {
        kind,
        value,
        response: Deferred.makeUnsafe<unknown, InterpreterFailure>(),
      };
      if (!asynchronous && O.isSome(state.active)) {
        return Effect.fail(InterpreterRuntimeError.new("Generator is already running.", node).as("TypeError"));
      }
      if (asynchronous && (state.completed || (!state.started && kind !== "next"))) {
        state.started = true;
        state.completed = true;
        state.pending.push(request);
        if (state.draining) return Deferred.await(request.response);
        state.draining = true;
        return Effect.andThen(
          this.promises.fork(
            invocation
              .completeGeneratorRequests(state, true)
              .pipe(Effect.ensuring(Effect.sync(() => (state.draining = false))))
          ),
          Deferred.await(request.response)
        );
      }
      if (state.completed) {
        if (kind === "throw") return Effect.fail(ProgramThrow.new(value));
        return Effect.succeed({
          value: kind === "return" ? value : undefined,
          done: true,
        });
      }
      if (!state.started && kind !== "next") {
        state.completed = true;
        if (kind === "throw") return Effect.fail(ProgramThrow.new(value));
        return Effect.succeed({ value, done: true });
      }

      state.pending.push(request);
      if (O.isSome(state.available)) {
        const available = state.available.value;
        state.available = O.none();
        Deferred.doneUnsafe(available, Exit.succeed(undefined));
      }
      if (!state.started) {
        state.started = true;
        const body = Effect.gen(function* () {
          state.active = O.some(yield* invocation.takeGeneratorRequest(state));
          const exit = yield* Effect.exit(
            run.pipe(
              Effect.filterOrElse(result => !asynchronous, result => invocation.awaitValue(result)),
              Effect.catch((error) =>
                InterpreterFailure.guards.GeneratorReturn(error)
                  ? asynchronous
                    ? invocation.awaitValue(error.value)
                    : Effect.succeed(error.value)
                  : Effect.fail(error)
              )
            )
          );
          const active = state.active;
          state.active = O.none();
          if (O.isSome(active)) {
            Deferred.doneUnsafe(
              active.value.response,
              Exit.isSuccess(exit)
                ? Exit.succeed({
                    value: exit.value,
                    done: true,
                  })
                : exit
            );
          }
          yield* invocation.completeGeneratorRequests(state, asynchronous);
          state.completed = true;
        });
        return Effect.andThen(this.promises.fork(body), Deferred.await(request.response));
      }
      return Deferred.await(request.response);
    };
    return CodeModeGenerator.new(asynchronous, (kind, value, node) =>
      Effect.provide(requestGenerator(kind, value, node), context)
    );
  }

  /**
   * Drains leftover generator requests after the body completes, settling return/throw waiters.
   *
   * **Example** (Read a generator return)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("function* g() { return 52 }; const it = g(); it.next(); return it.next().value")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 52
   * ```
   *
   * @since 0.0.0
   */
  private completeGeneratorRequests(state: GeneratorState, asynchronous: boolean): Effect.Effect<void, never, R> {
    const self = this;
    return Effect.gen(function* () {
      while (true) {
        const pending = self.dequeueGeneratorRequest(state);
        if (P.isUndefined(pending)) return;
        if (GeneratorRequestKind.is.throw(pending.kind)) {
          Deferred.doneUnsafe(pending.response, Exit.fail(ProgramThrow.new(pending.value)));
          continue;
        }
        if (asynchronous && pending.kind === "return") {
          const resolved = yield* Effect.exit(self.awaitValue(pending.value));
          Deferred.doneUnsafe(
            pending.response,
            Exit.isSuccess(resolved)
              ? Exit.succeed({
                  value: resolved.value,
                  done: true,
                })
              : resolved
          );
          continue;
        }
        Deferred.doneUnsafe(
          pending.response,
          Exit.succeed({
            value: GeneratorRequestKind.is.return(pending.kind) ? pending.value : undefined,
            done: true,
          })
        );
      }
    });
  }

  /**
   * Dequeues the next generator request, parking until one is posted when the queue is empty.
   *
   * **Example** (Resume a parked yield)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("function* g() { const n = yield 1; return n }; const it = g(); it.next(); return it.next(53).value")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 53
   * ```
   *
   * @since 0.0.0
   */
  private takeGeneratorRequest(state: GeneratorState): Effect.Effect<GeneratorRequest> {
    const next = this.dequeueGeneratorRequest(state);
    if (P.isNotUndefined(next)) return Effect.succeed(next);
    const available = Deferred.makeUnsafe<void>();
    state.available = O.some(available);
    return Effect.andThen(
      Deferred.await(available),
      Effect.suspend(() => {
        const request = this.dequeueGeneratorRequest(state);
        return P.isUndefined(request)
          ? Effect.die(InterpreterRuntimeError.new("CodeMode generator queue resumed without a pending request."))
          : Effect.succeed(request);
      })
    );
  }

  /**
   * Pops the next queued generator request, compacting the queue when it drains.
   *
   * **Example** (Queue two next calls)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("function* g() { yield 1; yield 2 }; const it = g(); return [it.next().value, it.next().value]")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // [1, 2]
   * ```
   *
   * @since 0.0.0
   */
  private dequeueGeneratorRequest(state: GeneratorState): GeneratorRequest | undefined {
    const request = state.pending[state.pendingIndex];
    if (P.isUndefined(request)) return undefined;
    state.pendingIndex += 1;
    if (state.pendingIndex === state.pending.length) {
      state.pending = [];
      state.pendingIndex = 0;
    }
    return request;
  }

  /**
   * Evaluates `yield` and `yield*`, failing when used outside a generator body.
   *
   * **Example** (Yield a value)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("function* g() { yield 54 }; return g().next().value")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 54
   * ```
   *
   * @since 0.0.0
   */
  private evaluateYieldExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const argument = getOptionalNode(node, "argument");
    const self = this;
    return Effect.gen(function* () {
      if (O.isNone(self.generatorState)) {
        throw InterpreterRuntimeError.new("yield is only valid inside a generator.", node);
      }
      if (node.delegate === true) {
        const value = P.isNotUndefined(argument) ? yield* self.evaluateExpression(argument) : undefined;
        return yield* self.delegateYield(value, node);
      }
      const value = P.isNotUndefined(argument) ? yield* self.evaluateExpression(argument) : undefined;
      const yielded = self.generatorAsync ? yield* self.awaitValue(value) : value;
      return yield* self.suspendGenerator(yielded, node);
    });
  }

  /**
   * Completes the active generator request with a yielded value and waits for the next request.
   *
   * **Example** (Resume after yield)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("function* g() { return yield 1 }; const it = g(); it.next(); return it.next(55).value")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 55
   * ```
   *
   * @since 0.0.0
   */
  private suspendGenerator(value: unknown, node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const state = this.generatorState;
    if (O.isNone(state) || O.isNone(state.value.active)) {
      throw InterpreterRuntimeError.new("Generator has no active request.", node);
    }
    Deferred.doneUnsafe(
      state.value.active.value.response,
      Exit.succeed({
        value,
        done: false,
      })
    );
    state.value.active = O.none();
    return Effect.flatMap(this.takeGeneratorRequest(state.value), (request) => {
      state.value.active = O.some(request);
      if (request.kind === "next") return Effect.succeed(request.value);
      if (request.kind === "throw") return Effect.fail(ProgramThrow.new(request.value));
      return this.generatorAsync
        ? Effect.flatMap(this.awaitValue(request.value), (value) => Effect.fail(GeneratorReturn.new(value)))
        : Effect.fail(GeneratorReturn.new(request.value));
    });
  }

  /**
   * Delegates `yield*` to an iterable or iterator, forwarding next/return/throw.
   *
   * **Example** (Yield from an array)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("function* g() { yield* [56] }; return g().next().value")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 56
   * ```
   *
   * @since 0.0.0
   */
  private delegateYield(value: unknown, node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      if (
        A.isArray(value) ||
        P.isString(value) ||
        CodeModeMap.is(value) ||
        CodeModeSet.is(value) ||
        CodeModeURLSearchParams.is(value)
      ) {
        const cursor = yield* self.syncIterator(value, node);
        if (P.isUndefined(cursor)) throw InterpreterRuntimeError.new("Built-in iterator is unavailable.", node);
        while (true) {
          const step = yield* cursor.next;
          if (step.done) return undefined;
          const resumed = yield* Effect.exit(
            self.suspendGenerator(self.generatorAsync ? yield* self.awaitValue(step.value) : step.value, node)
          );
          if (Exit.isSuccess(resumed)) continue;
          const error = Cause.squash(resumed.cause);
          if (InterpreterFailure.guards.GeneratorReturn(error)) {
            yield* cursor.close;
            return yield* Effect.fail(error);
          }
          if (InterpreterFailure.guards.ProgramThrow(error)) {
            yield* cursor.close;
            throw InterpreterRuntimeError.new("The delegated iterator does not provide a throw() method.", node).as(
              "TypeError"
            );
          }
          return yield* Effect.failCause(resumed.cause);
        }
      }

      const iteratorOption = yield* self.customIterator(value, node, self.generatorAsync);
      if (O.isNone(iteratorOption))
        throw InterpreterRuntimeError.new("yield* requires a compatible iterable value.", node).as("TypeError");
      const iterator = iteratorOption.value;
      let kind: GeneratorRequestKind = "next";
      let input: unknown;
      while (true) {
        const method =
          kind === "next"
            ? iterator.next
            : CodeModeGenerator.is(iterator.iterator)
              ? GeneratorMethodReference.new(iterator.iterator, kind)
              : iterator.iterator[kind];
        if (P.isUndefined(method) || P.isNull(method)) {
          if (kind === "return") return yield* Effect.fail(GeneratorReturn.new(input));
          yield* self.closeIterator(iterator, node, self.generatorAsync);
          throw InterpreterRuntimeError.new("The delegated iterator does not provide a throw() method.", node).as(
            "TypeError"
          );
        }
        const called = yield* self.invokeCallable(
          self.requireIteratorMethod(method, `Iterator ${kind}`, node),
          [input],
          node
        );
        const result = self.requireIteratorObject(
          iterator.asynchronous ? yield* self.awaitValue(called) : called,
          `Iterator ${kind}() result`,
          node
        );
        const done = Boolean(result.done);
        const resultValue: unknown =
          self.generatorAsync && !iterator.asynchronous
            ? yield* self.awaitAsyncFromSyncValue(iterator, result.value, node, kind !== "return" && !done)
            : result.value;
        if (done) {
          if (kind === "return") return yield* Effect.fail(GeneratorReturn.new(resultValue));
          return resultValue;
        }

        const resumed: Exit.Exit<unknown, InterpreterFailure> = yield* Effect.exit(
          self.suspendGenerator(resultValue, node)
        );
        if (Exit.isSuccess(resumed)) {
          kind = "next";
          input = resumed.value;
          continue;
        }
        const error: unknown = Cause.squash(resumed.cause);
        if (!InterpreterFailure.guards.GeneratorReturn(error) && !InterpreterFailure.guards.ProgramThrow(error)) {
          return yield* Effect.failCause(resumed.cause);
        }
        kind = InterpreterFailure.guards.GeneratorReturn(error) ? "return" : "throw";
        input = error.value;
      }
    });
  }

  /**
   * Builds a null-prototype object from init properties and object spread.
   *
   * **Example** (Spread into an object)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return { ...{ a: 1 }, b: 57 }")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * ```
   *
   * @since 0.0.0
   */
  private evaluateObjectExpression(node: AstNode): Effect.Effect<Record<string, unknown>, InterpreterFailure, R> {
    const objectValue: Record<string, unknown> = makeEmptySafeObject();
    const properties = getArray(node, "properties");
    const self = this;
    return Effect.gen(function* () {
      for (const propertyValue of properties) {
        const property = asNode(propertyValue, "properties");

        if (property.type === "SpreadElement") {
          const spread = yield* self.evaluateExpression(getNode(property, "argument"));
          if (spread === null || spread === undefined || isCodeModeValue(spread)) continue;
          if (!P.isObjectKeyword(spread) || A.isArray(spread) || isRuntimeReference(spread)) {
            throw InterpreterRuntimeError.new("Object spread requires a data object.", property, "InvalidDataValue");
          }
          for (const [key, value] of R.toEntries(spread)) {
            if (isBlockedMember(key))
              throw InterpreterRuntimeError.new(`Property '${key}' is not available.`, property);
            objectValue[key] = value;
          }
          copyIteratorSymbols(spread, objectValue);
          continue;
        }

        if (property.type !== "Property") {
          throw InterpreterRuntimeError.new("Only standard object properties are supported.", property);
        }

        if (getString(property, "kind") !== "init") {
          throw InterpreterRuntimeError.new("Only init object properties are supported.", property);
        }

        const keyNode = getNode(property, "key");
        const valueNode = getNode(property, "value");
        const computed = getBoolean(property, "computed");

        let key: PropertyKey;

        if (computed) {
          key = self.toPropertyKey(yield* self.evaluateExpression(keyNode), keyNode);
        } else if (keyNode.type === "Identifier") {
          key = getString(keyNode, "name");
        } else if (keyNode.type === "Literal") {
          key = self.toPropertyKey(keyNode.value, keyNode);
        } else {
          throw InterpreterRuntimeError.new("Unsupported object property key shape.", keyNode);
        }

        if (isBlockedMember(String(key))) {
          throw InterpreterRuntimeError.new(`Property '${String(key)}' is not available.`, keyNode);
        }
        Reflect.set(objectValue, key, yield* self.evaluateExpression(valueNode));
      }

      return objectValue;
    });
  }

  /**
   * Builds an array literal, preserving elisions as holes and expanding spread elements.
   *
   * **Example** (Spread into an array)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return [58, ...[59]]")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // [58, 59]
   * ```
   *
   * @since 0.0.0
   */
  private evaluateArrayExpression(node: AstNode): Effect.Effect<Array<unknown>, InterpreterFailure, R> {
    const elements = getArray(node, "elements");
    const values = A.empty<unknown>();

    const self = this;
    return Effect.gen(function* () {
      for (const elementValue of elements) {
        if (P.isNull(elementValue)) {
          // A literal elision is a real hole, like JS: extend length without an own index.
          values.length += 1;
          continue;
        }
        const element = asNode(elementValue, "elements");
        if (element.type === "SpreadElement") {
          const spread = yield* self.evaluateExpression(getNode(element, "argument"));
          const cursor = yield* self.syncIterator(spread, element);
          if (P.isUndefined(cursor))
            throw InterpreterRuntimeError.new("Array spread requires a synchronous iterable.", element).as("TypeError");
          while (true) {
            const step = yield* cursor.next;
            if (step.done) break;
            values.push(step.value);
          }
        } else {
          values.push(yield* self.evaluateExpression(element));
        }
      }
      return values;
    });
  }

  /**
   * Concatenates cooked template quasis with coerced interpolations.
   *
   * **Example** (Interpolate a number)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return `n=${60}`")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // n=60
   * ```
   *
   * @since 0.0.0
   */
  private evaluateTemplateLiteral(node: AstNode): Effect.Effect<string, InterpreterFailure, R> {
    const quasis = getArray(node, "quasis");
    const expressions = getArray(node, "expressions");

    let output = "";

    const self = this;
    return Effect.gen(function* () {
      for (let index = 0; index < quasis.length; index += 1) {
        const quasi = asNode(quasis[index], "quasis");
        const rawValue = quasi.value;

        if (!isRecord(rawValue) || !P.isString(rawValue.cooked)) {
          throw InterpreterRuntimeError.new("Invalid template literal quasi.", quasi);
        }

        output += rawValue.cooked;

        if (index < expressions.length) {
          const raw = yield* self.evaluateExpression(asNode(expressions[index], "expressions"));
          output += coerceToString(boundedData(raw, "Template interpolation"));
        }
      }

      return output;
    });
  }

  /**
   * Evaluates a ternary, choosing consequent or alternate by JavaScript truthiness.
   *
   * **Example** (Take the true branch)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return true ? 61 : 0")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 61
   * ```
   *
   * @since 0.0.0
   */
  private evaluateConditionalExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    return Effect.flatMap(this.evaluateExpression(getNode(node, "test")), (test) =>
      this.evaluateExpression(getNode(node, P.isTruthy(test) ? "consequent" : "alternate"))
    );
  }

  /**
   * Applies a compound assignment operator by delegating to the corresponding binary operator.
   *
   * **Example** (Add-assign)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("let n = 60; n += 2; return n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 62
   * ```
   *
   * @since 0.0.0
   */
  private applyCompoundAssignment(
    operator: typeof CompoundOperator.Encoded,
    current: unknown,
    incoming: unknown,
    node: AstNode
  ): unknown {
    return this.applyBinaryOperator(CompoundOperator.Enum[operator], current, incoming, node);
  }

  /**
   * Resolves a member expression into a tool path, builtin method handle, or data {@link MemberReference}.
   *
   * **Example** (Read a data property)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return { n: 63 }.n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 63
   * ```
   *
   * @since 0.0.0
   */
  private getMemberReference(
    node: AstNode,
    operation: "read" | "delete" = "read"
  ): Effect.Effect<
    | MemberReference
    | ToolReference
    | PromiseMethodReference
    | PromiseInstanceMethodReference
    | IntrinsicReference
    | GlobalMethodReference
    | JsonMethodReference
    | GeneratorMethodReference
    | ComputedValue
    | typeof OptionalShortCircuit
    | undefined,
    InterpreterFailure,
    R
  > {
    const objectNode = getNode(node, "object");
    const propertyNode = getNode(node, "property");
    const computed = getBoolean(node, "computed");
    const optional = node.optional === true;
    const self = this;
    return Effect.gen(function* () {
      const objectValue = yield* self.evaluateExpression(objectNode);
      if (objectValue === OptionalShortCircuit) return OptionalShortCircuit;
      if ((P.isNull(objectValue) || P.isUndefined(objectValue)) && optional) return OptionalShortCircuit;

      const key = computed
        ? self.toPropertyKey(yield* self.evaluateExpression(propertyNode), propertyNode)
        : propertyNode.type === "Identifier"
          ? getString(propertyNode, "name")
          : self.toPropertyKey(yield* self.evaluateExpression(propertyNode), propertyNode);

      if (ToolReference.is(objectValue)) {
        if (!P.isString(key)) {
          throw InterpreterRuntimeError.new("Tool paths must use string property names.", propertyNode);
        }
        return ToolReference.new(A.append(objectValue.path, key));
      }

      if (RuntimeReference.guards.PromiseNamespace(objectValue)) {
        if (P.isString(key) && S.is(PromiseMethodName)(key)) {
          return PromiseMethodReference.new(key);
        }
        throw InterpreterRuntimeError.new(
          `Promise.${String(key)} is not available. Available: Promise.all, Promise.allSettled, Promise.race, Promise.any, Promise.resolve, and Promise.reject; consume promises with await.`,
          propertyNode
        );
      }

      if (RuntimeReference.guards.SymbolNamespace(objectValue)) {
        if (key === "asyncIterator") return ComputedValue.new(AsyncIteratorSymbol);
        if (key === "iterator") return ComputedValue.new(IteratorSymbol);
        return ComputedValue.new(undefined);
      }

      if (RuntimeReference.guards.GlobalNamespace(objectValue)) {
        if (P.isString(key) && isBlockedMember(key)) {
          throw InterpreterRuntimeError.new(`${objectValue.name}.${key} is not available.`, propertyNode);
        }
        if (!P.isString(key)) return ComputedValue.new(undefined);
        const missing = (): ComputedValue => ComputedValue.new(undefined);

        return GlobalNamespaceName.$match(objectValue.name, {
          Math: () =>
            S.is(mathConstants)(key)
              ? ComputedValue.new(Reflect.get(Math, key))
              : S.is(mathMethods)(key)
                ? GlobalMethodReference.new(GlobalMethod.cases.Math.make({ name: key }))
                : missing(),
          JSON: () => (S.is(JsonMethodName)(key) ? JsonMethodReference.new(key) : missing()),
          Object: () =>
            S.is(objectStatics)(key)
              ? GlobalMethodReference.new(GlobalMethod.cases.Object.make({ name: key }))
              : missing(),
          Array: () =>
            S.is(arrayStatics)(key)
              ? GlobalMethodReference.new(GlobalMethod.cases.Array.make({ name: key }))
              : missing(),
          console: () =>
            S.is(ConsoleMethod)(key)
              ? GlobalMethodReference.new(GlobalMethod.cases.console.make({ name: key }))
              : missing(),
          Date: () =>
            S.is(dateStatics)(key) ? GlobalMethodReference.new(GlobalMethod.cases.Date.make({ name: key })) : missing(),
          RegExp: () =>
            S.is(regexpStatics)(key)
              ? GlobalMethodReference.new(GlobalMethod.cases.RegExp.make({ name: key }))
              : missing(),
          Map: () =>
            S.is(mapStatics)(key) ? GlobalMethodReference.new(GlobalMethod.cases.Map.make({ name: key })) : missing(),
          Set: missing,
          URL: () =>
            S.is(UrlStatic)(key) ? GlobalMethodReference.new(GlobalMethod.cases.URL.make({ name: key })) : missing(),
          URLSearchParams: missing,
        });
      }

      if (P.isString(objectValue)) {
        if (key === "length") return ComputedValue.new(objectValue.length);
        const index = P.isSymbol(key) ? undefined : parseArrayIndex(key);
        if (P.isNotUndefined(index)) return ComputedValue.new(objectValue[index]);
        if (P.isString(key) && S.is(stringMethods)(key)) {
          return IntrinsicReference.new(IntrinsicMethod.cases.String.make({ receiver: objectValue, name: key }));
        }
        return ComputedValue.new(undefined);
      }

      if (P.isNumber(objectValue)) {
        if (P.isString(key) && S.is(numberMethods)(key)) {
          return IntrinsicReference.new(IntrinsicMethod.cases.Number.make({ receiver: objectValue, name: key }));
        }
        return ComputedValue.new(undefined);
      }

      if (RuntimeReference.guards.CoercionFunction(objectValue)) {
        if (P.isString(key) && isBlockedMember(key)) {
          throw InterpreterRuntimeError.new(`${objectValue.name}.${key} is not available.`, propertyNode);
        }
        if (!P.isString(key)) return ComputedValue.new(undefined);
        const missing = (): ComputedValue => ComputedValue.new(undefined);
        return CoercionFunctionName.$match(objectValue.name, {
          Number: () => {
            if (S.is(numberConstants)(key)) {
              return ComputedValue.new(Reflect.get(Number, key));
            }
            return S.is(numberStatics)(key)
              ? GlobalMethodReference.new(GlobalMethod.cases.Number.make({ name: key }))
              : missing();
          },
          String: () =>
            S.is(stringStatics)(key)
              ? GlobalMethodReference.new(GlobalMethod.cases.String.make({ name: key }))
              : missing(),
          Boolean: missing,
          parseInt: missing,
          parseFloat: missing,
          isFinite: missing,
          isNaN: missing,
        });
      }

      if (CodeModeDate.is(objectValue)) {
        if (P.isString(key) && S.is(dateMethods)(key)) {
          return IntrinsicReference.new(IntrinsicMethod.cases.Date.make({ receiver: objectValue, name: key }));
        }
        return ComputedValue.new(undefined);
      }
      if (CodeModeRegExp.is(objectValue)) {
        if (key === "lastIndex") return MemberReference.new(objectValue, key);
        if (P.isString(key) && S.is(regexpProperties)(key)) {
          return ComputedValue.new(Reflect.get(objectValue.regex, key));
        }
        if (P.isString(key) && S.is(regexpMethods)(key)) {
          return IntrinsicReference.new(IntrinsicMethod.cases.RegExp.make({ receiver: objectValue, name: key }));
        }
        return ComputedValue.new(undefined);
      }
      if (CodeModeMap.is(objectValue)) {
        if (key === "size") return ComputedValue.new(objectValue.map.size);
        if (P.isString(key) && S.is(mapMethods)(key)) {
          return IntrinsicReference.new(IntrinsicMethod.cases.Map.make({ receiver: objectValue, name: key }));
        }
        return ComputedValue.new(undefined);
      }
      if (CodeModeSet.is(objectValue)) {
        if (key === "size") return ComputedValue.new(objectValue.set.size);
        if (P.isString(key) && S.is(setMethods)(key)) {
          return IntrinsicReference.new(IntrinsicMethod.cases.Set.make({ receiver: objectValue, name: key }));
        }
        return ComputedValue.new(undefined);
      }
      if (CodeModeURL.is(objectValue)) {
        if (key === "searchParams") {
          return ComputedValue.new(objectValue.searchParams);
        }
        if (P.isString(key) && S.is(UrlMethod)(key)) {
          return IntrinsicReference.new(IntrinsicMethod.cases.URL.make({ receiver: objectValue, name: key }));
        }
        if (P.isString(key) && S.is(urlProperties)(key)) {
          return MemberReference.new(objectValue, key);
        }
        return ComputedValue.new(undefined);
      }
      if (CodeModeURLSearchParams.is(objectValue)) {
        if (key === "size") return ComputedValue.new(objectValue.params.size);
        if (P.isString(key) && S.is(UrlSearchParamsMethod)(key)) {
          return IntrinsicReference.new(
            IntrinsicMethod.cases.URLSearchParams.make({ receiver: objectValue, name: key })
          );
        }
        return ComputedValue.new(undefined);
      }

      // Reject unknown promise properties so a missing await cannot hide.
      if (CodeModePromise.is(objectValue)) {
        if (key === "then" || key === "catch" || key === "finally") {
          return PromiseInstanceMethodReference.new(objectValue, key);
        }
        throw InterpreterRuntimeError.new(
          "This value is an un-awaited Promise; await it first - e.g. `const result = await tools.ns.tool(...)`.",
          objectNode,
          "InvalidDataValue"
        );
      }

      if (CodeModeGenerator.is(objectValue)) {
        if (key === "next" || key === "return" || key === "throw") {
          return GeneratorMethodReference.new(objectValue, key);
        }
        if (
          (key === IteratorSymbol && !objectValue.asynchronous) ||
          (key === AsyncIteratorSymbol && objectValue.asynchronous)
        ) {
          return GeneratorMethodReference.new(objectValue, "iterator");
        }
        return ComputedValue.new(undefined);
      }

      if (isRuntimeReference(objectValue)) {
        throw InterpreterRuntimeError.new(
          "Runtime references are opaque and do not expose properties.",
          objectNode,
          "InvalidDataValue"
        );
      }

      if (!P.isObjectKeyword(objectValue) || P.isNull(objectValue)) {
        throw InterpreterRuntimeError.new("Cannot access a property on a non-object value.", objectNode);
      }

      if (P.isString(key) && isBlockedMember(key)) {
        throw InterpreterRuntimeError.new(`Property '${key}' is not available.`, propertyNode);
      }

      if (A.isArray(objectValue)) {
        if (operation === "delete") {
          return MemberReference.new(objectValue, key);
        }
        const index = P.isSymbol(key) ? undefined : parseArrayIndex(key);
        if (key !== "length" && !(P.isString(key) && S.is(arrayMethods)(key)) && index === undefined) {
          if (P.isString(key) && P.hasProperty(objectValue, key)) {
            return ComputedValue.new(Reflect.get(objectValue, key));
          }
          return ComputedValue.new(undefined);
        }
        return MemberReference.new(objectValue, index ?? key);
      }

      if (!S.is(SafeObjectSchema)(objectValue)) {
        throw InterpreterRuntimeError.new("Cannot access a property on a non-data object.", objectNode);
      }
      return MemberReference.new(objectValue, key);
    });
  }

  /**
   * Reads the value of a resolved member, including optional chaining short-circuit.
   *
   * **Example** (Optional-chain a missing object)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const obj = null; return obj?.n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // undefined
   * ```
   *
   * @since 0.0.0
   */
  private readMember(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    return Effect.map(this.getMemberReference(node), (reference) => {
      if (reference === OptionalShortCircuit) return OptionalShortCircuit;
      if (ComputedValue.is(reference)) return reference.value;
      if (P.isUndefined(reference) || OpaqueMemberReference.is(reference)) return reference;
      if (A.isArray(reference.target)) {
        if (reference.key === "length") return reference.target.length;
        if (P.isString(reference.key) && S.is(arrayMethods)(reference.key)) {
          return IntrinsicReference.new(
            IntrinsicMethod.cases.Array.make({ receiver: reference.target, name: reference.key })
          );
        }
        return Reflect.get(reference.target, reference.key);
      }
      if (CodeModeRegExp.is(reference.target)) return reference.target.lastIndex;
      if (CodeModeURL.is(reference.target)) {
        return Reflect.get(reference.target.url, reference.key);
      }
      return Reflect.get(reference.target, reference.key);
    });
  }

  /**
   * Writes a value into a data member reference after resolving the member expression.
   *
   * **Example** (Assign an object property)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const obj = { n: 0 }; obj.n = 64; return obj.n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 64
   * ```
   *
   * @since 0.0.0
   */
  private writeMember(node: AstNode, value: unknown): Effect.Effect<unknown, InterpreterFailure, R> {
    return this.modifyMember(node, () =>
      Effect.succeed({
        write: true,
        next: value,
        result: value,
      })
    );
  }

  /**
   * Deletes a data member when the argument is a member expression; other delete targets succeed as `true`.
   *
   * **Example** (Delete an own property)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const obj = { n: 1 }; delete obj.n; return obj.n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // undefined
   * ```
   *
   * @since 0.0.0
   */
  private evaluateDeleteExpression(argument: AstNode): Effect.Effect<boolean, InterpreterFailure, R> {
    const target = argument.type === "ChainExpression" ? getNode(argument, "expression") : argument;
    if (target.type !== "MemberExpression") {
      throw InterpreterRuntimeError.new("Only data fields may be deleted.", argument);
    }
    return Effect.map(this.getMemberReference(target, "delete"), (reference) => {
      if (reference === OptionalShortCircuit) return true;
      if (
        ComputedValue.is(reference) ||
        P.isUndefined(reference) ||
        OpaqueMemberReference.is(reference) ||
        CodeModeURL.is(reference.target)
      ) {
        throw InterpreterRuntimeError.new("Only data fields may be deleted.", target, "InvalidDataValue");
      }
      if (CodeModeRegExp.is(reference.target)) {
        return Reflect.deleteProperty(reference.target.regex, reference.key);
      }
      return Reflect.deleteProperty(reference.target, reference.key);
    });
  }

  // Resolve side-effecting object and key expressions exactly once.
  /**
   * Reads a member, applies an updater, and writes the result back for compound and update operators.
   *
   * **Example** (Increment a property)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const obj = { n: 64 }; obj.n++; return obj.n")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 65
   * ```
   *
   * @since 0.0.0
   */
  private modifyMember(
    node: AstNode,
    compute: (current: unknown) => Effect.Effect<
      {
        write: boolean;
        next: unknown;
        result: unknown;
      },
      InterpreterFailure,
      R
    >
  ): Effect.Effect<unknown, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      const reference = yield* self.getMemberReference(node);
      if (
        reference === OptionalShortCircuit ||
        ComputedValue.is(reference) ||
        P.isUndefined(reference) ||
        OpaqueMemberReference.is(reference)
      ) {
        throw InterpreterRuntimeError.new("Only data fields may be assigned.", node);
      }
      if (A.isArray(reference.target)) {
        if (reference.key === "length") throw InterpreterRuntimeError.new("Array length cannot be assigned.", node);
        if (P.isString(reference.key) && S.is(arrayMethods)(reference.key)) {
          throw InterpreterRuntimeError.new("Array methods cannot be assigned.", node);
        }
      }
      const key = reference.key;
      const { write, next, result } = yield* compute(self.readReferenceValue(reference, key));
      if (write) self.assignToReference(reference, key, next, node);
      return result;
    });
  }

  /**
   * Reads one property from a {@link MemberReference} target, including array indices.
   *
   * **Example** (Read an array index)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("return [66][0]")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 66
   * ```
   *
   * @since 0.0.0
   */
  private readReferenceValue(reference: MemberReference, key: PropertyKey): unknown {
    if (CodeModeURL.is(reference.target)) {
      return Reflect.get(reference.target.url, key);
    }
    if (CodeModeRegExp.is(reference.target)) return reference.target.lastIndex;
    return Reflect.get(reference.target, key);
  }

  /**
   * Writes a property onto a data object or array, rejecting circular insertions.
   *
   * **Example** (Write an array index)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const xs = [0]; xs[0] = 67; return xs[0]")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 67
   * ```
   *
   * @since 0.0.0
   */
  private assignToReference(reference: MemberReference, key: PropertyKey, next: unknown, node: AstNode): void {
    if (A.isArray(reference.target)) {
      const target = reference.target;
      if (!P.isNumber(key) || P.isUndefined(parseArrayIndex(key))) {
        throw InterpreterRuntimeError.new(
          "Array assignment index must be a valid array index.",
          node,
          "InvalidDataValue"
        );
      }
      rejectCircularInsertion(target, next, "Array assignment result", node);
      target[key] = next;
      return;
    }
    if (CodeModeURL.is(reference.target)) {
      if (!P.isString(key) || !S.is(urlWritableProperties)(key)) {
        throw InterpreterRuntimeError.new(`URL.${String(key)} is read-only.`, node).as("TypeError");
      }
      try {
        Reflect.set(reference.target.url, key, uriArgument(next, `URL.${key} value`));
        return;
      } catch (error) {
        if (
          InterpreterFailure.guards.InterpreterRuntimeError(error) ||
          InterpreterFailure.guards.ToolRuntimeError(error)
        )
          throw error;
        throw InterpreterRuntimeError.new(`URL.${key} received an invalid value.`, node).as("TypeError");
      }
    }
    if (CodeModeRegExp.is(reference.target)) {
      reference.target.lastIndex = next;
      return;
    }
    if (!S.is(SafeObjectSchema)(reference.target)) {
      throw InterpreterRuntimeError.new("Cannot assign a property on a non-data object.", node);
    }
    const target = reference.target;
    rejectCircularInsertion(target, next, "Object assignment result", node);
    Reflect.set(target, key, next);
  }

  /**
   * Coerces a computed property to a string, number, or iterator symbol; other keys TypeError.
   *
   * **Example** (Read a computed key)
   *
   * ```ts
   * import { CodeMode } from "@beep/scratchpad/codemode"
   * import { Effect } from "effect"
   *
   * const result = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const runtime = yield* CodeMode.make({})
   *     return yield* runtime.execute("const key = \"n\"; return { n: 68 }[key]")
   *   }),
   * )
   * console.log(result.ok === true ? result.value : result)
   * // 68
   * ```
   *
   * @since 0.0.0
   */
  private toPropertyKey(value: unknown, node: AstNode): PropertyKey {
    if (P.isString(value) || P.isNumber(value)) {
      return value;
    }
    if (value === AsyncIteratorSymbol || value === IteratorSymbol) return value;

    throw InterpreterRuntimeError.new(
      "Property key must be a string or number, or Symbol.asyncIterator/Symbol.iterator.",
      node
    );
  }
}
