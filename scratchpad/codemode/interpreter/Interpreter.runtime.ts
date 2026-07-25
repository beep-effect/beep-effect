import {
  Cause,
  Context,
  DateTime,
  Deferred,
  Effect,
  Exit,
  Match,
  MutableHashMap,
  MutableHashSet,
  MutableRef,
  Random,
} from "effect";
import * as S from "effect/Schema";
import {
  SafeObject as SafeObjectSchema,
  type SafeObject
} from "@beep/schema/SafeObject";
import {A, O, P, pipe} from "@beep/utils";
import {
  isBlockedMember,
  ToolReference,
  ToolRuntimeError
} from "../Codemode.tool-runtime.ts";
import {
  type AstNode,
  AsyncIteratorSymbol,
  asNode,
  Binding,
  CodeModeFunction,
  CodeModeGenerator,
  CoercionFunction,
  ComputedValue,
  ErrorConstructorReference,
  GlobalMethodReference,
  GlobalNamespace,
  GeneratorMethodReference,
  GeneratorReturn,
  type GeneratorRequestKind,
  type GlobalNamespaceName,
  getArray,
  getBoolean,
  getNode,
  getOptionalNode,
  getString,
  IntrinsicReference,
  type InterpreterFailure,
  InterpreterRuntimeError,
  isRecord,
  IteratorSymbol,
  IteratorSymbols,
  JsonMethodReference,
  MemberReference,
  OptionalShortCircuit,
  PromiseCapabilityFunction,
  PromiseInstanceMethodReference,
  PromiseMethodReference,
  PromiseNamespace,
  ProgramThrow,
  type ProgramNode,
  SearchFunction,
  StatementBreak,
  StatementContinue,
  StatementNone,
  StatementResult,
  StatementReturn,
  SymbolNamespace,
  unsupportedSyntax,
  UriFunction,
} from "./Interpreter.model.ts";
import {
  caughtErrorValue,
  constructAggregateErrorValue,
  constructErrorValue
} from "./Interpreter.errors.ts";
import {
  arrayStatics,
  type CallbackRunner,
  invokeArrayFrom,
  invokeGlobalMethod,
  invokeGroupBy,
  invokeIntrinsic,
} from "./Interpreter.methods.ts";
import {
  preserveConsumerError,
  type SyncIteratorRunner
} from "./Interpreter.iterator.ts";
import {
  constructPromise,
  invokePromiseInstanceMethod,
  invokePromiseMethod,
  PromiseRuntime,
  resolvePromise,
  resolvePromiseValue,
} from "./Interpreter.promises.ts";
import {
  containsOpaqueReference,
  isRuntimeReference,
  rejectCircularInsertion,
  typeofValue
} from "./Interpreter.references.ts";
import {ScopeStack} from "./Interpreter.scope.ts";
import {
  arrayMethods,
  mapMethods,
  mapStatics,
  setMethods
} from "../stdlib/index.ts";
import {consoleMethods, formatConsoleMessage} from "../stdlib/index.ts";
import {dateMethods, dateStatics} from "../stdlib/index.ts";
import {
  invokeJsonMethod,
  jsonStatics,
} from "../stdlib/index.ts";
import {
  invokeMathSumPrecise,
  mathConstants,
  mathMethods
} from "../stdlib/index.ts";
import {
  numberConstants,
  numberMethods,
  numberStatics
} from "../stdlib/index.ts";
import {
  invokeObjectFromEntries,
  objectMethodsPreservingIdentity,
  objectStatics
} from "../stdlib/index.ts";
import {promiseStatics} from "../stdlib/index.ts";
import {
  escapeRegexHint,
  regexpMethods,
  regexpProperties,
  regexpStatics,
  regexFailureReason,
} from "../stdlib/index.ts";
import {stringMethods, stringStatics} from "../stdlib/index.ts";
import {
  urlMethods,
  urlProperties,
  urlSearchParamsMethods,
  urlStatics,
  urlWritableProperties,
  invokeUriFunction,
  uriArgument,
  urlArgument,
} from "../stdlib/index.ts";
import {
  boundedData,
  coerceToNumber,
  coerceToString,
  compoundOperators,
  errorBrandName,
  errorConstructors,
  invokeCoercion,
  valueConstructors,
} from "../stdlib/index.ts";
import {
  isCodeModeValue,
  CodeModeDate,
  CodeModeMap,
  CodeModePromise,
  CodeModeRegExp,
  CodeModeSet,
  CodeModeURL,
  CodeModeURLSearchParams,
} from "../Codemode.values.ts";

const globalStaticMembers: Partial<Record<GlobalNamespaceName, S.Top>> = {
  Object: objectStatics,
  Math: mathMethods,
  Array: arrayStatics,
  console: consoleMethods,
  Date: dateStatics,
  RegExp: regexpStatics,
  Map: mapStatics,
  URL: urlStatics,
};

const MAX_ARRAY_LENGTH = 4_294_967_295;
const encodeJson = S.encodeUnknownSync(S.UnknownFromJsonString);

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
        : property.type === "Literal" && typeof property.value === "string"
          ? property.value
          : undefined;
    if (object.type === "Identifier" && key !== undefined) return `${getString(object, "name")}.${key}`;
  }
  return "The called value";
};

const instanceofValue = (lhs: unknown, rhs: unknown, node: AstNode): boolean => {
  const unsupported = (): never => {
    throw InterpreterRuntimeError.new(
      "The right-hand side of 'instanceof' must be a supported constructor: Error (or a specific error type like TypeError), Date, RegExp, Map, Set, URL, URLSearchParams, Array, Object, or Promise.",
      node,
    );
  };

  if (S.is(ErrorConstructorReference)(rhs)) {
    const brand = errorBrandName(lhs);
    return ErrorConstructorReference.match(rhs, {
      Error: () => P.isNotUndefined(brand),
      TypeError: () => brand === "TypeError",
      RangeError: () => brand === "RangeError",
      SyntaxError: () => brand === "SyntaxError",
      ReferenceError: () => brand === "ReferenceError",
      EvalError: () => brand === "EvalError",
      URIError: () => brand === "URIError",
      AggregateError: () => brand === "AggregateError",
    });
  }
  if (S.is(GlobalNamespace)(rhs)) {
    return GlobalNamespace.match(rhs, {
      Date: () => lhs instanceof CodeModeDate,
      RegExp: () => lhs instanceof CodeModeRegExp,
      Map: () => lhs instanceof CodeModeMap,
      Set: () => lhs instanceof CodeModeSet,
      URL: () => lhs instanceof CodeModeURL,
      URLSearchParams: () => lhs instanceof CodeModeURLSearchParams,
      Array: () => A.isArray(lhs),
      Object: () => lhs !== null && (typeof lhs === "object" || typeofValue(lhs) === "function"),
      Math: unsupported,
      JSON: unsupported,
      console: unsupported,
    });
  }
  if (S.is(PromiseNamespace)(rhs)) return lhs instanceof CodeModePromise;
  if (S.is(CoercionFunction)(rhs)) {
    return CoercionFunction.match(rhs, {
      Boolean: () => false,
      Number: () => false,
      String: () => false,
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
      A.flatMap(
        getArray(pattern, "elements"),
        (element) => element === null ? [] : collectPatternNames(asNode(element, "elements")),
      )),
    Match.when("ObjectPattern", () =>
      A.flatMap(getArray(pattern, "properties"), (property) => {
        const prop = asNode(property, "properties");
        return collectPatternNames(
          prop.type === "RestElement" ? getNode(prop, "argument") : getNode(prop, "value"),
        );
      })),
    Match.orElse(() => []),
  );

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
  iterator: SafeObject | CodeModeGenerator
  next: unknown
  asynchronous: boolean
}

const OpaqueMemberReference = S.Union([
  ToolReference,
  PromiseMethodReference,
  PromiseInstanceMethodReference,
  IntrinsicReference,
  GlobalMethodReference,
  JsonMethodReference,
  GeneratorMethodReference,
]).pipe(S.toTaggedUnion("_tag"));

type OpaqueMemberReference = typeof OpaqueMemberReference.Type;

const isOpaqueMemberReference = S.is(OpaqueMemberReference);

const copyIteratorSymbols = (
  source: object,
  target: object,
  consumed: O.Option<MutableHashSet.MutableHashSet<PropertyKey>> = O.none(),
): void => {
  for (const symbol of IteratorSymbols) {
    if (!O.exists(consumed, (keys) => MutableHashSet.has(keys, symbol)) && Object.hasOwn(source, symbol))
      Reflect.set(target, symbol, Reflect.get(source, symbol));
  }
};

type LoopLabels = MutableHashSet.MutableHashSet<string>;

const escapesLoopLabels = (
  label: O.Option<string>,
  labels: O.Option<LoopLabels>,
): boolean =>
  O.exists(label, (name) => !O.exists(labels, (names) => MutableHashSet.has(names, name)));

type GeneratorRequest = {
  kind: GeneratorRequestKind
  value: unknown
  response: Deferred.Deferred<unknown, InterpreterFailure>
}

type GeneratorState = {
  started: boolean
  completed: boolean
  draining: boolean
  active: O.Option<GeneratorRequest>
  pending: Array<GeneratorRequest>
  pendingIndex: number
  available: O.Option<Deferred.Deferred<void>>
}

const promiseResolutionNode: AstNode = {type: "PromiseResolution"};

export class Interpreter<R> {
  private scopes: ScopeStack;
  private readonly executeTool: (
    path: ReadonlyArray<string>,
    args: Array<unknown>,
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
    logs: Array<string> = [],
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
    for (const name of errorConstructors.Options) {
      MutableHashMap.set(
        globalScope,
        name,
        Binding.new(false, ErrorConstructorReference.new(name))
      );
    }
  }

  run(program: ProgramNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const self = this;
    // Keep top-level declarations separate so they can shadow builtins.
    this.scopes.push();
    return Effect.gen(function* () {
      self.predeclareLexical(program.body);
      self.hoistFunctions(program.body);
      let value: unknown = undefined;
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

        if (
          StatementResult.isAnyOf(["Break", "Continue"])(result)
        ) {
          throw InterpreterRuntimeError.new(
            `Unexpected '${result._tag.toLowerCase()}' outside of a loop.`,
            statement
          );
        }
      }

      // The implicit async body adopts returned promises before copy-out.
      value = yield* resolvePromiseValue(self.runner, value, program);
      return value;
    }).pipe(Effect.ensuring(Effect.sync(() => self.scopes.pop())));
  }

  // Fork at the call site so admission and hooks occur when the call is made.
  private createToolCallPromise(
    path: ReadonlyArray<string>,
    args: Array<unknown>,
  ): Effect.Effect<CodeModePromise, never, R> {
    return this.createPromise(Effect.suspend(() => this.executeTool(path, args)));
  }

  private createPromise(effect: Effect.Effect<unknown, InterpreterFailure, R>): Effect.Effect<CodeModePromise, never, R> {
    return this.promises.create(effect);
  }

  // Fiber exits make settlement idempotent; yielding prevents inline continuation.
  private settlePromise(promise: CodeModePromise): Effect.Effect<unknown, InterpreterFailure, never> {
    const promises = this.promises;
    return Effect.suspend(() => {
      promises.markObserved(promise);
      return Effect.flatMap(promises.await(promise), (exit) => Effect.andThen(Effect.yieldNow, exit));
    });
  }

  private evaluateStatement(node: AstNode): Effect.Effect<StatementResult, InterpreterFailure, R> {
    return Match.value(node.type).pipe(
      Match.when("ExpressionStatement", () =>
        Effect.as(
          this.evaluateExpression(getNode(node, "expression")),
          StatementNone.new()
        )),
      Match.when("VariableDeclaration", () =>
        Effect.as(this.evaluateVariableDeclaration(node), StatementNone.new())),
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
      Match.orElse(() => {
        throw unsupportedSyntax(node.type, node);
      }),
    );
  }

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

  private createFunction(node: AstNode): CodeModeFunction {
    return CodeModeFunction.new(
      getArray(node, "params").map((parameter, index) => asNode(parameter, `params[${index}]`)),
      getNode(node, "body"),
      this.scopes.capture(),
      node.async === true,
      node.generator === true,
    );
  }

  private hoistFunctions(statements: ReadonlyArray<unknown>): void {
    for (const statementValue of statements) {
      if (!isRecord(statementValue) || statementValue.type !== "FunctionDeclaration") continue;
      const node = statementValue as AstNode;
      this.scopes.declare(getString(getNode(node, "id"), "name"), this.createFunction(node), true, node);
    }
  }

  private predeclareLexical(statements: ReadonlyArray<unknown>): void {
    for (const statementValue of statements) {
      if (!isRecord(statementValue) || statementValue.type !== "VariableDeclaration") continue;
      const statement = statementValue as AstNode;
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

  private predeclarePattern(pattern: AstNode, mutable: boolean, node: AstNode): void {
    for (const name of collectPatternNames(pattern)) this.scopes.reserve(name, mutable, node);
  }

  private evaluateIfStatement(node: AstNode): Effect.Effect<StatementResult, InterpreterFailure, R> {
    const testNode = getNode(node, "test");
    const consequentNode = getNode(node, "consequent");
    const alternateNode = getOptionalNode(node, "alternate");

    return Effect.flatMap(this.evaluateExpression(testNode), (test) =>
      P.isTruthy(test)
        ? this.evaluateStatement(consequentNode)
        : P.isNotNullish(alternateNode)
          ? this.evaluateStatement(alternateNode)
          : Effect.succeed(StatementNone.new()),
    );
  }

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
          for (const statementValue of getArray(cases[index]!, "consequent")) {
            const result = yield* self.evaluateStatement(asNode(statementValue, "consequent"));
            if (StatementResult.guards.Break(result)) {
              if (O.isNone(result.label)) return StatementNone.new();
              return result;
            }
            if (
              StatementResult.isAnyOf(["Return", "Continue"])(result)
            ) return result;
          }
        }
        return StatementNone.new();
      }).pipe(Effect.ensuring(Effect.sync(() => self.scopes.pop())));
    });
  }

  private evaluateWhileStatement(
    node: AstNode,
    labels: O.Option<LoopLabels> = O.none(),
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

  private evaluateDoWhileStatement(
    node: AstNode,
    labels: O.Option<LoopLabels> = O.none(),
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

  private evaluateForStatement(
    node: AstNode,
    labels: O.Option<LoopLabels> = O.none(),
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
          ? pipe(
            MutableHashMap.keys(self.scopes.current()),
            A.fromIterable
          )
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

        if (
          StatementResult.guards.Continue(result) &&
          escapesLoopLabels(result.label, labels)
        ) return result;

        nextIteration();
        if (P.isNotNullish(updateNode)) {
          yield* self.evaluateExpression(updateNode);
        }

        if (StatementResult.guards.Continue(result)) {
          continue;
        }
      }

      return StatementNone.new();
    }).pipe(Effect.ensuring(Effect.sync(() => self.scopes.pop())));
  }

  private evaluateForOfStatement(
    node: AstNode,
    labels: O.Option<LoopLabels> = O.none(),
  ): Effect.Effect<StatementResult, InterpreterFailure, R> {
    const awaiting = getBoolean(node, "await");
    const left = getNode(node, "left");
    const declared = loopDeclaration(left, "for...of");
    if (P.isNotNullish(declared?.lexical)) this.scopes.push();

    const self = this;
    return Effect.gen(function* () {
      if (P.isNotNullish(declared?.lexical)) self.predeclarePattern(declared.pattern, declared.mutable, left);
      const right = yield* self.evaluateExpression(getNode(node, "right"));
      const body = getNode(node, "body");

      const iteratorOption = yield* self.customIterator(right, node, awaiting);
      const cursor = O.isNone(iteratorOption) ? yield* self.syncIterator(right, node) : undefined;
      if (O.isNone(iteratorOption) && P.isUndefined(cursor)) {
        throw InterpreterRuntimeError.new(
          `${awaiting ? "for await...of" : "for...of"} requires an array, string, Map, Set, or URLSearchParams, or custom iterator value.`,
          node,
        ).as("TypeError");
      }
      const close = () =>
        O.match(iteratorOption, {
          onNone: () =>
            awaiting
              ? Effect.andThen(cursor?.close ?? Effect.void, Effect.yieldNow)
              : (cursor?.close ?? Effect.void),
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

      const evaluateBody =
        Effect.fnUntraced(function* (value: unknown) {
          if (P.isNotNullish(declared)) {
            self.scopes.push();
            if (declared.lexical) self.predeclarePattern(declared.pattern, declared.mutable, left);
            yield* self.declarePattern(declared.pattern, value, declared.mutable, left, declared.lexical);
          } else if (P.isNotNullish(assignment)) {
            yield* self.assignPattern(assignment, value, left);
          }
          return yield* self.evaluateStatement(body);
        }, Effect.ensuring(
          Effect.sync(() => {
            if (P.isNotNullish(declared)) self.scopes.pop();
          }),
        ));

      while (true) {
        const current = O.isSome(iteratorOption)
          ? yield* self.nextIteratorResult(iteratorOption.value, node, awaiting)
          : yield* cursor?.next ?? Effect.fail(InterpreterRuntimeError.new("Iterator is unavailable.", node));
        const step = P.isTruthy(cursor && awaiting) ? {
          done: current.done,
          value: yield* self.awaitValue(current.value)
        } : current;
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

        if (
          StatementResult.guards.Continue(result) &&
          escapesLoopLabels(result.label, labels)
        ) {
          yield* close();
          return result;
        }
      }
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          if (P.isNotNullish(declared?.lexical)) self.scopes.pop();
        }),
      ),
    );
  }

  private awaitValue(value: unknown, node: AstNode = promiseResolutionNode): Effect.Effect<unknown, InterpreterFailure, R> {
    return Effect.flatMap(resolvePromise(this.runner, this.promises, value, node), (promise) =>
      this.settlePromise(promise),
    );
  }

  private awaitAsyncFromSyncValue(
    iterator: CustomIterator,
    value: unknown,
    node: AstNode,
    closeOnRejection: boolean,
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

  private syncIterator(value: unknown, node: AstNode) {
    const iterator = A.isArray(value)
      ? value[Symbol.iterator]()
      : typeof value === "string"
        ? value[Symbol.iterator]()
        : value instanceof CodeModeMap
          ? value.map.entries()
          : value instanceof CodeModeSet
            ? value.set.values()
            : value instanceof CodeModeURLSearchParams
              ? value.params.entries()
              : undefined;
    if (iterator !== undefined) {
      return Effect.succeed({
        next: Effect.sync(() => {
          const step = iterator.next();
          return {done: Boolean(step.done), value: step.value};
        }),
        close: Effect.void,
      });
    }
    const self = this;
    return Effect.map(
      this.customIterator(value, node, false),
      O.match({
        onNone: () => undefined,
        onSome: (iterator) => ({
          next: self.nextIteratorResult(iterator, node, false),
          close: Effect.suspend(() => self.closeIterator(iterator, node, false)),
        }),
      }),
    );
  }

  private customIterator(
    value: unknown,
    node: AstNode,
    allowAsync = true,
  ): Effect.Effect<O.Option<CustomIterator>, InterpreterFailure, R> {
    if (S.is(CodeModeGenerator)(value)) {
      if (value.asynchronous && !allowAsync) return Effect.succeed(O.none());
      return Effect.succeed(O.some({
        iterator: value,
        next: GeneratorMethodReference.new(value, "next"),
        asynchronous: value.asynchronous,
      }));
    }
    if (!isRecord(value) || isRuntimeReference(value)) return Effect.succeed(O.none());
    const asyncMethod = allowAsync ? Reflect.get(value, AsyncIteratorSymbol) : undefined;
    const method = asyncMethod ?? Reflect.get(value, IteratorSymbol);
    if (P.isUndefined(method) || P.isNull(method)) return Effect.succeed(O.none());
    const self = this;
    return Effect.map(
      this.invokeCallable(this.requireIteratorMethod(method, "Iterator method", node), [], node),
      (iterator) => {
        const object = self.requireIterator(iterator, node);
        return O.some({
          iterator: object,
          next:
            S.is(CodeModeGenerator)(object)
              ? GeneratorMethodReference.new(object, "next")
              : self.requireIteratorMethod(object.next, "Iterator next", node),
          asynchronous: asyncMethod !== undefined && asyncMethod !== null,
        });
      },
    );
  }

  private nextIteratorResult(iterator: CustomIterator, node: AstNode, awaiting: boolean) {
    const self = this;
    return Effect.gen(function* () {
      if (iterator.asynchronous) {
        const object = self.requireIteratorObject(
          yield* self.awaitValue(yield* self.invokeCallable(iterator.next, [], node)),
          "Iterator next() result",
          node,
        );
        return {done: Boolean(object.done), value: object.value};
      }

      const called = yield* Effect.exit(self.invokeCallable(iterator.next, [], node));
      if (!Exit.isSuccess(called)) {
        if (awaiting) yield* Effect.yieldNow;
        return yield* Effect.failCause(called.cause);
      }
      const captured = yield* Effect.exit(
        Effect.sync(() => {
          const object = self.requireIteratorObject(called.value, "Iterator next() result", node);
          return {done: Boolean(object.done), value: object.value};
        }),
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

  private closeIterator(iterator: CustomIterator, node: AstNode, awaiting = true): Effect.Effect<void, InterpreterFailure, R> {
    const close =
      S.is(CodeModeGenerator)(iterator.iterator)
        ? GeneratorMethodReference.new(iterator.iterator, "return")
        : iterator.iterator.return;
    if (close === undefined || close === null) return iterator.asynchronous || !awaiting ? Effect.void : Effect.yieldNow;
    const self = this;
    return Effect.gen(function* () {
      const method = self.requireIteratorMethod(close, "Iterator return", node);
      if (iterator.asynchronous) {
        self.requireIteratorObject(
          yield* self.awaitValue(yield* self.invokeCallable(method, [], node)),
          "Iterator return() result",
          node,
        );
        return;
      }

      const called = yield* Effect.exit(self.invokeCallable(method, [], node));
      if (!Exit.isSuccess(called)) {
        if (awaiting) yield* Effect.yieldNow;
        return yield* Effect.failCause(called.cause);
      }
      const captured = yield* Effect.exit(
        Effect.sync(() => self.requireIteratorObject(called.value, "Iterator return() result", node).value),
      );
      if (!Exit.isSuccess(captured)) {
        if (awaiting) yield* Effect.yieldNow;
        return yield* Effect.failCause(captured.cause);
      }
      if (awaiting) yield* self.awaitValue(captured.value);
    });
  }

  private requireIteratorObject(value: unknown, context: string, node: AstNode): SafeObject {
    if (S.is(SafeObjectSchema)(value) && !isRuntimeReference(value)) return value;
    throw InterpreterRuntimeError.new(`${context} must be an object.`, node).as("TypeError");
  }

  private requireIterator(value: unknown, node: AstNode): SafeObject | CodeModeGenerator {
    return S.is(CodeModeGenerator)(value)
      ? value
      : this.requireIteratorObject(value, "Iterator method result", node);
  }

  private requireIteratorMethod(value: unknown, context: string, node: AstNode): unknown {
    if (typeofValue(value) === "function") return value;
    throw InterpreterRuntimeError.new(`${context} must be a function.`, node).as("TypeError");
  }

  private enumerableKeys(value: unknown): Array<string> | undefined {
    if (S.is(ToolReference)(value)) {
      return [...this.toolKeys(value.path)];
    }
    if (Array.isArray(value)) {
      return Object.keys(value);
    }
    if (P.isNotNull(value) && P.isObjectKeyword(value) && !isRuntimeReference(value)) {
      return Object.keys(value);
    }
    return undefined;
  }

  private evaluateForInStatement(
    node: AstNode,
    labels: O.Option<LoopLabels> = O.none(),
  ): Effect.Effect<StatementResult, InterpreterFailure, R> {
    const left = getNode(node, "left");
    const declared = loopDeclaration(left, "for...in");
    if (P.isNotNullish(declared?.lexical)) this.scopes.push();

    const self = this;
    return Effect.gen(function* () {
      if (P.isNotNullish(declared?.lexical)) self.predeclarePattern(declared.pattern, declared.mutable, left);
      const right = yield* self.evaluateExpression(getNode(node, "right"));
      const body = getNode(node, "body");

      const keys = self.enumerableKeys(right);
      if (keys === undefined) {
        throw InterpreterRuntimeError.new(
          "for...in requires a plain object, array, or tools reference. Use for...of for arrays/strings/Maps/Sets, or Object.keys(value) for a key list.",
          node,
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
          if (P.isNotNullish(declared)) {
            self.scopes.push();
            if (declared.lexical) self.predeclarePattern(declared.pattern, declared.mutable, left);
            yield* self.declarePattern(declared.pattern, key, declared.mutable, left, declared.lexical);
          } else if (P.isNotUndefined(assignmentName)) {
            self.scopes.set(assignmentName, key, left);
          }
          return yield* self.evaluateStatement(body);
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              if (P.isNotUndefined(declared)) self.scopes.pop();
            }),
          ),
        );

        if (StatementResult.guards.Return(result)) {
          return result;
        }

        if (StatementResult.guards.Break(result)) {
          if (escapesLoopLabels(result.label, labels)) return result;
          return StatementNone.new();
        }

        if (StatementResult.guards.Continue(result)) {
          if (escapesLoopLabels(result.label, labels)) return result;
          continue;
        }
      }

      return StatementNone.new();
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          if (P.isNotNullish(declared?.lexical)) self.scopes.pop();
        }),
      ),
    );
  }

  private evaluateBreakStatement(node: AstNode): StatementResult {
    const labelNode = getOptionalNode(node, "label");
    return StatementBreak.new(
      P.isNotNullish(labelNode)
        ? getString(labelNode, "name")
        : undefined
    );
  }

  private evaluateContinueStatement(node: AstNode): StatementResult {
    const labelNode = getOptionalNode(node, "label");
    return StatementContinue.new(
      P.isNotNullish(labelNode)
        ? getString(labelNode, "name")
        : undefined
    );
  }

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
      StatementResult.guards.Break(result) &&
      O.exists(result.label, (label) => MutableHashSet.has(labels, label))
        ? StatementNone.new()
        : result,
    );
  }

  private evaluateThrowStatement(node: AstNode): Effect.Effect<StatementResult, InterpreterFailure, R> {
    const argument = getNode(node, "argument");
    return Effect.flatMap(this.evaluateExpression(argument), (value) => Effect.fail(ProgramThrow.new(value)));
  }

  private evaluateTryStatement(node: AstNode): Effect.Effect<StatementResult, InterpreterFailure, R> {
    const body = getNode(node, "block");
    const handler = getOptionalNode(node, "handler");
    const finalizer = getOptionalNode(node, "finalizer");
    const self = this;

    const attempted = Effect.matchCauseEffect(this.evaluateStatement(body), {
      onFailure: (cause) => {
        if (
          cause.reasons.some(Cause.isInterruptReason) ||
          S.is(GeneratorReturn)(Cause.squash(cause)) ||
          P.isUndefined(handler)
        ) {
          return Effect.failCause(cause);
        }

        const caught = caughtErrorValue(Cause.squash(cause));
        const parameter = getOptionalNode(handler, "param");
        self.scopes.push();
        return Effect.gen(function* () {
          if (P.isNotNullish(parameter)) yield* self.declarePattern(parameter, caught, true, handler);
          return yield* self.evaluateStatement(getNode(handler, "body"));
        }).pipe(Effect.ensuring(Effect.sync(() => self.scopes.pop())));
      },
      onSuccess: Effect.succeed,
    });

    if (P.isNullish(finalizer)) return attempted;

    const isAbrupt = StatementResult.isAnyOf([
      "Return",
      "Break",
      "Continue",
    ]);

    return Effect.matchCauseEffect(attempted, {
      onFailure: (cause) =>
        cause.reasons.some(Cause.isInterruptReason)
          ? Effect.failCause(cause)
          : Effect.flatMap(this.evaluateStatement(finalizer), (final) =>
            isAbrupt(final) ? Effect.succeed(final) : Effect.failCause(cause),
          ),
      onSuccess: (result) =>
        Effect.flatMap(this.evaluateStatement(finalizer), (final) =>
          isAbrupt(final) ? Effect.succeed(final) : Effect.succeed(result),
        ),
    });
  }

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
        const value = P.isNotNullish(init) ? yield* self.evaluateExpression(init) : undefined;
        yield* self.declarePattern(getNode(declaration, "id"), value, kind !== "const", declaration, kind !== "var");
      }
    });
  }

  private declarePattern(
    pattern: AstNode,
    value: unknown,
    mutable: boolean,
    node: AstNode,
    initialize = false,
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
        if (P.isNull(value) || !P.isObjectKeyword(value) || isRuntimeReference(value)) {
          throw InterpreterRuntimeError.new(
            "Object destructuring requires a data object or array value.",
            pattern,
            "InvalidDataValue",
          );
        }

        const consumed = MutableHashSet.empty<PropertyKey>();
        for (const propertyValue of getArray(pattern, "properties")) {
          const property = asNode(propertyValue, "properties");

          if (property.type === "RestElement") {
            const rest: SafeObject = Object.create(null) as SafeObject;
            for (const [key, item] of Object.entries(value as SafeObject)) {
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
          MutableHashSet.add(consumed, typeof key === "symbol" ? key : String(key));
          yield* self.declarePattern(
            getNode(property, "value"),
            self.destructuringPropertyValue(value as SafeObject | Array<unknown>, key),
            mutable,
            property,
            initialize,
          );
        }
        return;
      }

      if (pattern.type === "ArrayPattern") {
        return yield* self.destructureArrayPattern(pattern, value, (target, item, context) =>
          self.declarePattern(target, item, mutable, context, initialize),
        );
      }

      throw InterpreterRuntimeError.new(`Unsupported binding pattern '${pattern.type}'.`, pattern);
    });
  }

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
        if (P.isNull(value) || !P.isObjectKeyword(value) || isRuntimeReference(value)) {
          throw InterpreterRuntimeError.new(
            "Object destructuring requires a data object or array value.",
            pattern,
            "InvalidDataValue",
          );
        }

        const source = value as SafeObject | Array<unknown>;
        const consumed = MutableHashSet.empty<PropertyKey>();
        for (const propertyValue of getArray(pattern, "properties")) {
          const property = asNode(propertyValue, "properties");
          if (property.type === "RestElement") {
            const rest: SafeObject = Object.create(null) as SafeObject;
            for (const [key, item] of Object.entries(source)) {
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
          MutableHashSet.add(consumed, typeof key === "symbol" ? key : String(key));
          yield* self.assignPattern(getNode(property, "value"), self.destructuringPropertyValue(source, key), property);
        }
        return;
      }

      if (pattern.type === "ArrayPattern") {
        return yield* self.destructureArrayPattern(pattern, value, (target, item, context) =>
          self.assignPattern(target, item, context),
        );
      }

      throw InterpreterRuntimeError.new(`Unsupported assignment pattern '${pattern.type}'.`, node);
    });
  }

  private destructureArrayPattern(
    pattern: AstNode,
    value: unknown,
    consume: (target: AstNode, value: unknown, context: AstNode) => Effect.Effect<void, InterpreterFailure, R>,
  ): Effect.Effect<void, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      const cursor = yield* self.syncIterator(value, pattern);
      if (P.isUndefined(cursor)) {
        throw InterpreterRuntimeError.new("Array destructuring requires a supported iterable value.", pattern).as(
          "TypeError",
        );
      }
      let done = false;
      for (const [index, item] of getArray(pattern, "elements").entries()) {
        if (done) {
          if (item === null) continue;
          const element = asNode(item, `elements[${index}]`);
          yield* consume(
            element.type === "RestElement" ? getNode(element, "argument") : element,
            element.type === "RestElement" ? [] : undefined,
            element,
          );
          if (element.type === "RestElement") return;
          continue;
        }
        const step = yield* cursor.next;
        done = step.done;
        if (item === null) continue;
        const element = asNode(item, `elements[${index}]`);
        if (element.type === "RestElement") {
          const rest = A.empty<unknown>();;
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

  private destructuringPropertyValue(source: SafeObject | Array<unknown>, key: PropertyKey): unknown {
    if (!Array.isArray(source)) return Reflect.get(source, key);
    if (key === "length") return source.length;
    if (P.isNumber(key)) return source[key];
    if (Object.hasOwn(source, key)) return Reflect.get(source, key);
    if (P.isString(key) && S.is(arrayMethods)(key)) return IntrinsicReference.new(source, key);
    return undefined;
  }

  private evaluateExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") {
      return Effect.sync(() => this.createFunction(node));
    }
    return Match.value(node.type).pipe(
      Match.when("Literal", () => {
        const regex = node.regex;
        if (isRecord(regex) && typeof regex.pattern === "string") {
          return Effect.sync(() =>
            this.constructRegExp([regex.pattern, typeof regex.flags === "string" ? regex.flags : ""], node),
          );
        }
        return Effect.sync(() => boundedData(node.value, "Literal"));
      }),
      Match.when("Identifier", () => Effect.sync(() => this.scopes.get(getString(node, "name"), node))),
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
          value === OptionalShortCircuit ? undefined : value,
        )),
      Match.when("ObjectExpression", () => this.evaluateObjectExpression(node)),
      Match.when("ArrayExpression", () => this.evaluateArrayExpression(node)),
      Match.when("TemplateLiteral", () => this.evaluateTemplateLiteral(node)),
      Match.when("ConditionalExpression", () => this.evaluateConditionalExpression(node)),
      Match.when("UpdateExpression", () => this.evaluateUpdateExpression(node)),
      Match.when("AwaitExpression", () =>
        // Await always suspends, including for plain values.
        Effect.flatMap(this.evaluateExpression(getNode(node, "argument")), (value) =>
          this.awaitValue(value, node),
        )),
      Match.when("YieldExpression", () => this.evaluateYieldExpression(node)),
      Match.when("NewExpression", () => this.evaluateNewExpression(node)),
      Match.orElse(() => {
        throw unsupportedSyntax(node.type, node);
      }),
    );
  }

  private evaluateNewExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const callee = getNode(node, "callee");
    if (callee.type !== "Identifier") {
      throw unsupportedSyntax("NewExpression", node);
    }
    const name = getString(callee, "name");
    const argNodes = getArray(node, "arguments");
    const self = this;
    if (name === "Promise") {
      return Effect.flatMap(this.evaluateCallArguments(argNodes), (args) =>
        constructPromise(self.runner, self.promises, args[0], node),
      );
    }
    if (S.is(errorConstructors)(name)) {
      return Effect.flatMap(this.evaluateCallArguments(argNodes), (args) =>
        name === "AggregateError"
          ? constructAggregateErrorValue(self.runner, args, node)
          : Effect.succeed(constructErrorValue(name, args)),
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
          RegExp: () => Effect.sync(() => self.constructRegExp(args, node)),
          Map: () => self.constructMap(args[0], node),
          Set: () => self.constructSet(args[0], node),
          URL: () => Effect.sync(() => self.constructURL(args, node)),
          URLSearchParams: () => self.constructURLSearchParams(args[0], node),
        });
      });
    }
    throw unsupportedSyntax("NewExpression", node);
  }

  private constructArray(args: Array<unknown>, node: AstNode): Array<unknown> {
    if (args.length !== 1) return [...args];
    const first = args[0];
    if (typeof first !== "number") return [first];
    if (!Number.isInteger(first) || first < 0 || first > 4294967295) {
      throw InterpreterRuntimeError.new("Invalid array length.", node).as("RangeError");
    }
    // Sparse like JS: Array(3) has holes, and combinator loops already skip them.
    return new Array(first);
  }

  private constructObject(args: Array<unknown>, node: AstNode): unknown {
    const first = args[0];
    if (P.isNull(first) || P.isUndefined(first)) return {};
    if (P.isObjectKeyword(first)) return first;
    throw InterpreterRuntimeError.new(
      `Object(${typeof first}) wrapper objects are not supported; use the primitive value directly.`,
      node,
    );
  }

  private constructDate(args: Array<unknown>, node: AstNode): Effect.Effect<CodeModeDate, InterpreterFailure, R> {
    if (A.isArrayEmpty(args)) {
      return DateTime.now.pipe(
        Effect.map((now) => CodeModeDate.new(DateTime.toEpochMillis(now))),
      );
    }
    if (args.length === 1) {
      const arg = args[0];
      if (arg instanceof CodeModeDate) return Effect.succeed(CodeModeDate.new(arg.time));
      return Effect.map(this.toDatePrimitive(arg, node), (value) =>
        typeof value === "string"
          ? CodeModeDate.new(Date.parse(value))
          : CodeModeDate.new(
            pipe(
              DateTime.make(coerceToNumber(value)),
              O.match({
                onNone: () => Number.NaN,
                onSome: DateTime.toEpochMillis,
              }),
            ),
          ),
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
        },
      ),
      O.match({
        onNone: () => Number.NaN,
        onSome: DateTime.toEpochMillis,
      }),
    );
    return Effect.succeed(CodeModeDate.new(time));
  }

  private toDatePrimitive(value: unknown, node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    if (P.isNull(value) || (!P.isObjectKeyword(value) && typeof value !== "function")) return Effect.succeed(value);
    const object = value as Record<string, unknown>;
    const self = this;
    return Effect.gen(function* () {
      if (Object.hasOwn(object, "valueOf") && typeofValue(object.valueOf) === "function") {
        const result = yield* self.runner.invokeCallable(object.valueOf, [], node);
        if (result === null || (typeof result !== "object" && typeof result !== "function")) return result;
      }
      if (!Object.hasOwn(object, "toString")) return coerceToString(value);
      if (typeofValue(object.toString) === "function") {
        const result = yield* self.runner.invokeCallable(object.toString, [], node);
        if (result === null || (typeof result !== "object" && typeof result !== "function")) return result;
      }
      throw InterpreterRuntimeError.new("Cannot convert object to primitive value.", node).as("TypeError");
    });
  }

  private constructRegExp(args: Array<unknown>, node: AstNode): CodeModeRegExp {
    const first = args[0];
    const pattern =
      first instanceof CodeModeRegExp ? first.regex.source : P.isUndefined(first) ? "" : coerceToString(first);
    const flagsArg = args[1];
    if (flagsArg !== undefined && typeof flagsArg !== "string") {
      throw InterpreterRuntimeError.new(
        `RegExp flags must be a string of flag characters (e.g. "g", "gi"), not ${flagsArg === null ? "null" : typeof flagsArg}.`,
        node,
      ).as("SyntaxError");
    }
    const flags = flagsArg ?? (first instanceof CodeModeRegExp ? first.regex.flags : "");
    try {
      return CodeModeRegExp.new(pattern, flags);
    } catch (error) {
      const reason = regexFailureReason(error);
      throw InterpreterRuntimeError.new(
        /flag/i.test(reason)
          ? `new RegExp(...) received invalid flags ${encodeJson(flags)} (${reason}). Valid flags are d, g, i, m, s, u, v, and y.`
          : `new RegExp(...) received ${encodeJson(pattern)}, which is not a valid regular expression pattern (${reason}). ${escapeRegexHint}`,
        node,
      ).as("SyntaxError");
    }
  }

  private constructMap(init: unknown, node: AstNode): Effect.Effect<CodeModeMap, InterpreterFailure, R> {
    const target = CodeModeMap.new();
    if (P.isUndefined(init) || P.isNull(init)) return Effect.succeed(target);
    const self = this;
    return Effect.gen(function* () {
      const cursor = yield* self.syncIterator(init, node);
      if (P.isUndefined(cursor)) {
        throw InterpreterRuntimeError.new(
          "new Map(...) expects an iterable of [key, value] pairs or no argument.",
          node,
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
                "TypeError",
              );
            }
            target.map.set(Reflect.get(step.value, 0), Reflect.get(step.value, 1));
          }),
        );
      }
    });
  }

  private constructSet(init: unknown, node: AstNode): Effect.Effect<CodeModeSet, InterpreterFailure, R> {
    const target = CodeModeSet.new();
    if (P.isUndefined(init) || P.isNull(init)) return Effect.succeed(target);
    const self = this;
    return Effect.gen(function* () {
      const cursor = yield* self.syncIterator(init, node);
      if (P.isUndefined(cursor)) {
        throw InterpreterRuntimeError.new("new Set(...) expects a synchronous iterable or no argument.", node).as(
          "TypeError",
        );
      }
      while (true) {
        const step = yield* cursor.next;
        if (step.done) return target;
        target.set.add(step.value);
      }
    });
  }

  private constructURL(args: Array<unknown>, node: AstNode): CodeModeURL {
    if (A.isArrayEmpty(args)) {
      throw InterpreterRuntimeError.new("new URL(...) requires a URL string and an optional base URL.", node).as(
        "TypeError",
      );
    }
    const input = urlArgument(args[0], "new URL input");
    const base = args[1] === undefined ? undefined : urlArgument(args[1], "new URL base");
    try {
      return CodeModeURL.new(new URL(input, base));
    } catch {
      throw InterpreterRuntimeError.new(
        `new URL(...) received an invalid URL${base === undefined ? "" : " or base URL"}.`,
        node,
      ).as("TypeError");
    }
  }

  private constructURLSearchParams(init: unknown, node: AstNode): Effect.Effect<CodeModeURLSearchParams, InterpreterFailure, R> {
    if (P.isUndefined(init)) return Effect.succeed(CodeModeURLSearchParams.new(new URLSearchParams()));
    if (init instanceof CodeModeURLSearchParams) {
      return Effect.succeed(CodeModeURLSearchParams.new(new URLSearchParams(init.params)));
    }
    if (typeof init === "string") return Effect.succeed(CodeModeURLSearchParams.new(new URLSearchParams(init)));
    if (P.isNull(init) || typeof init === "number" || typeof init === "boolean") {
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
                node,
              ).as("TypeError");
            }
            return CodeModeURLSearchParams.new(
              new URLSearchParams(entries.map((entry): [string, string] => [entry[0] ?? "", entry[1] ?? ""])),
            );
          }
          entries.push(yield* preserveConsumerError(cursor, self.readURLSearchParamsPair(step.value, node)));
        }
      }
      if (isRuntimeReference(init)) {
        throw InterpreterRuntimeError.new(
          "new URLSearchParams(...) expects a query string, data object, or synchronous iterable pairs.",
          node,
        ).as("TypeError");
      }
      if (isCodeModeValue(init)) return CodeModeURLSearchParams.new(new URLSearchParams());
      const data = boundedData(init, "new URLSearchParams input");
      if (P.isNull(data) || typeof data !== "object") {
        throw InterpreterRuntimeError.new(
          "new URLSearchParams(...) expects a query string, data object, iterable pairs, or URLSearchParams.",
          node,
        ).as("TypeError");
      }
      return CodeModeURLSearchParams.new(
        new URLSearchParams(
          Object.fromEntries(Object.entries(data).map(([key, value]) => [key, coerceToString(value)])),
        ),
      );
    });
  }

  private readURLSearchParamsPair(value: unknown, node: AstNode): Effect.Effect<Array<string>, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      const cursor = yield* self.syncIterator(value, node);
      if (P.isUndefined(cursor)) {
        throw InterpreterRuntimeError.new("new URLSearchParams(...) expects iterable [name, value] pairs.", node).as(
          "TypeError",
        );
      }
      const items: Array<string> = [];
      while (true) {
        const step = yield* cursor.next;
        if (step.done) return items;
        items.push(
          yield* preserveConsumerError(
            cursor,
            Effect.sync(() => uriArgument(step.value, "URLSearchParams pair value")),
          ),
        );
      }
    });
  }

  private evaluateBinaryExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const operator = getString(node, "operator");
    const self = this;
    return Effect.gen(function* () {
      const lhs = yield* self.evaluateExpression(getNode(node, "left"));
      const rhs = yield* self.evaluateExpression(getNode(node, "right"));
      if (operator === "instanceof") return instanceofValue(lhs, rhs, node);
      return boundedData(self.applyBinaryOperator(operator, lhs, rhs, node), "Binary expression result");
    });
  }

  private applyBinaryOperator(operator: string, lhs: unknown, rhs: unknown, node: AstNode): unknown {
    if (operator === "===") return lhs === rhs;
    if (operator === "!==") return lhs !== rhs;
    if (containsOpaqueReference(lhs) || containsOpaqueReference(rhs)) {
      throw InterpreterRuntimeError.new("Binary operators require data values.", node, "InvalidDataValue");
    }
    // Null-prototype data needs explicit primitive coercion; identity and `in` retain raw objects.
    // Dates use their default string hint for addition and loose equality, and epoch time elsewhere.
    const coerceOperand = (operand: unknown): unknown => {
      if (operand instanceof CodeModeDate) {
        return operator === "+" || operator === "==" || operator === "!=" ? coerceToString(operand) : operand.time;
      }
      return operand !== null && typeof operand === "object" ? coerceToString(operand) : operand;
    };
    const bothObjects = lhs !== null && typeof lhs === "object" && rhs !== null && typeof rhs === "object";
    const l = coerceOperand(lhs);
    const r = coerceOperand(rhs);
    return Match.value(operator).pipe(
      Match.when("+", () => (l as string) + (r as string)),
      Match.when("-", () => (l as number) - (r as number)),
      Match.when("*", () => (l as number) * (r as number)),
      Match.when("/", () => (l as number) / (r as number)),
      Match.when("%", () => (l as number) % (r as number)),
      Match.when("**", () => (l as number) ** (r as number)),
      Match.when("==", () => bothObjects ? lhs === rhs : l == r),
      Match.when("!=", () => bothObjects ? lhs !== rhs : l != r),
      Match.when("<", () => (l as string) < (r as string)),
      Match.when("<=", () => (l as string) <= (r as string)),
      Match.when(">", () => (l as string) > (r as string)),
      Match.when(">=", () => (l as string) >= (r as string)),
      Match.when("&", () => (l as number) & (r as number)),
      Match.when("|", () => (l as number) | (r as number)),
      Match.when("^", () => (l as number) ^ (r as number)),
      Match.when("<<", () => (l as number) << (r as number)),
      Match.when(">>", () => (l as number) >> (r as number)),
      Match.when(">>>", () => (l as number) >>> (r as number)),
      Match.when("in", () => {
        if (rhs === null || typeof rhs !== "object") {
          throw InterpreterRuntimeError.new("The 'in' operator requires a data object on the right-hand side.", node);
        }
        // Never expose properties inherited from host prototypes.
        return Object.hasOwn(rhs as object, coerceOperand(lhs) as PropertyKey);
      }),
      Match.orElse(() => {
        throw InterpreterRuntimeError.new(`Unsupported binary operator '${operator}'.`, node);
      }),
    );
  }

  private evaluateLogicalExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const operator = getString(node, "operator");
    return Effect.flatMap(this.evaluateExpression(getNode(node, "left")), (left) => {
      if (operator === "&&") return P.isTruthy(left) ? this.evaluateExpression(getNode(node, "right")) : Effect.succeed(left);
      if (operator === "||") return P.isTruthy(left) ? Effect.succeed(left) : this.evaluateExpression(getNode(node, "right"));
      if (operator === "??")
        return left !== null && left !== undefined
          ? Effect.succeed(left)
          : this.evaluateExpression(getNode(node, "right"));
      throw InterpreterRuntimeError.new(`Unsupported logical operator '${operator}'.`, node);
    });
  }

  private evaluateUnaryExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const operator = getString(node, "operator");
    const argument = getNode(node, "argument");
    if (operator === "delete") return this.evaluateDeleteExpression(argument);
    // Undeclared names short-circuit, but declared TDZ bindings must still throw.
    if (
      operator === "typeof" &&
      argument.type === "Identifier" &&
      O.isNone(this.scopes.resolve(getString(argument, "name")))
    ) {
      return Effect.succeed("undefined");
    }
    return Effect.map(this.evaluateExpression(argument), (value) => {
      if (operator === "typeof") return typeofValue(value);
      if (operator === "!") return !P.isTruthy(value);
      if (operator === "void") return undefined;
      if (containsOpaqueReference(value)) {
        throw InterpreterRuntimeError.new("Unary operators require data values.", node, "InvalidDataValue");
      }
      const operand =
        value instanceof CodeModeDate
          ? value.time
          : P.isNotNull(value) && P.isObjectKeyword(value)
            ? coerceToString(value)
            : value;
      const result = Match.value(operator).pipe(
        Match.when("+", () => +(operand as number)),
        Match.when("-", () => -(operand as number)),
        Match.when("~", () => ~(operand as number)),
        Match.orElse(() => {
          throw InterpreterRuntimeError.new(`Unsupported unary operator '${operator}'.`, node);
        }),
      );
      return boundedData(result, "Unary expression result");
    });
  }

  private evaluateAssignmentExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const left = getNode(node, "left");
    const operator = getString(node, "operator");
    const self = this;
    return Effect.gen(function* () {
      if (operator === "??=" || operator === "||=" || operator === "&&=") {
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
            "Assignment result",
          );
          return self.scopes.set(name, next, left);
        }
        const rightValue = yield* self.evaluateExpression(getNode(node, "right"));
        return self.scopes.set(name, rightValue, left);
      }
      if (left.type === "MemberExpression") {
        return yield* self.modifyMember(left, (current) =>
          Effect.map(self.evaluateExpression(getNode(node, "right")), (rightValue) => {
            if (operator === "=") return {
              write: true,
              next: rightValue,
              result: rightValue
            };
            const next = boundedData(
              self.applyCompoundAssignment(operator, current, rightValue, node),
              "Assignment result",
            );
            return {write: true, next, result: next};
          }),
        );
      }
      throw InterpreterRuntimeError.new("Assignment target must be an Identifier or MemberExpression.", left);
    });
  }

  private evaluateLogicalAssignment(
    node: AstNode,
    left: AstNode,
    operator: string,
  ): Effect.Effect<unknown, InterpreterFailure, R> {
    const self = this;
    const shouldAssign = (current: unknown): boolean =>
      operator === "??="
        ? P.isNull(current) || P.isUndefined(current)
        : operator === "||="
          ? !P.isTruthy(current)
          : P.isTruthy(current);
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
          : Effect.succeed({write: false, next: current, result: current}),
      );
    }
    throw InterpreterRuntimeError.new("Assignment target must be an Identifier or MemberExpression.", left);
  }

  private evaluateUpdateExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const operator = getString(node, "operator");
    const argument = getNode(node, "argument");
    const prefix = getBoolean(node, "prefix");

    const increment = operator === "++" ? 1 : operator === "--" ? -1 : undefined;

    if (increment === undefined) {
      throw InterpreterRuntimeError.new(`Unsupported update operator '${operator}'.`, node);
    }

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
          result: prefix ? next : value
        });
      });
    }

    throw InterpreterRuntimeError.new("Update target must be an Identifier or MemberExpression.", argument);
  }

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

  // The single dispatch for every invocation: call expressions and callbacks share it.
  private invokeCallable(
    callable: unknown,
    args: Array<unknown>,
    node: AstNode,
    callee: AstNode = node,
  ): Effect.Effect<unknown, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      if (S.is(ToolReference)(callable)) {
        if (callable.path.length === 0) throw InterpreterRuntimeError.new("The tools root is not callable.", callee);
        return yield* self.createToolCallPromise(callable.path, args);
      }
      if (S.is(PromiseMethodReference)(callable)) {
        return yield* invokePromiseMethod(self.runner, self.promises, callable, args, node);
      }
      if (S.is(PromiseInstanceMethodReference)(callable)) {
        return yield* invokePromiseInstanceMethod(self.runner, self.promises, callable, args, node);
      }
      if (S.is(CodeModeFunction)(callable)) {
        return yield* self.invokeFunction(callable, args);
      }
      if (S.is(GeneratorMethodReference)(callable)) {
        const request = (
          generator: CodeModeGenerator,
          kind: GeneratorRequestKind,
        ): Effect.Effect<unknown, InterpreterFailure, R> => {
          const requested = generator.request(kind, args[0], node);
          return generator.asynchronous
            ? self.createPromise(requested)
            : requested;
        };

        return yield* GeneratorMethodReference.match(callable, {
          iterator: ({ generator }) => Effect.succeed(generator),
          next: ({ generator }) => request(generator, "next"),
          return: ({ generator }) => request(generator, "return"),
          throw: ({ generator }) => request(generator, "throw"),
        });
      }
      if (S.is(IntrinsicReference)(callable)) {
        return yield* invokeIntrinsic(self.runner, callable, args, node);
      }
      if (S.is(GlobalMethodReference)(callable)) {
        const invokeBounded = (
          reference: GlobalMethodReference,
        ): Effect.Effect<unknown, InterpreterFailure> =>
          Effect.succeed(
            boundedData(
              invokeGlobalMethod(reference, args, node),
              `${reference.namespace}.${reference.name} result`,
            ),
          );

        return yield* GlobalMethodReference.match(callable, {
          console: ({ name }) => Effect.succeed(self.invokeConsole(name, args, node)),
          Object: (reference) => {
            if (S.is(ToolReference)(args[0])) {
              return Effect.succeed(self.invokeObjectMethodOnTools(reference.name, args[0], node));
            }
            if (S.is(objectMethodsPreservingIdentity)(reference.name)) {
              return reference.name === "fromEntries"
                ? invokeObjectFromEntries(self.runner, args[0], node)
                : Effect.succeed(invokeGlobalMethod(reference, args, node));
            }
            return reference.name === "groupBy"
              ? invokeGroupBy(self.runner, "Object", args, node)
              : invokeBounded(reference);
          },
          Math: (reference) => {
            if (reference.name === "random") return Random.next;
            return reference.name === "sumPrecise"
              ? invokeMathSumPrecise(self.runner, args[0], node)
              : invokeBounded(reference);
          },
          Array: (reference) => {
            if (reference.name === "from") return invokeArrayFrom(self.runner, args, node);
            return reference.name === "of"
              ? Effect.succeed(invokeGlobalMethod(reference, args, node))
              : invokeBounded(reference);
          },
          Map: (reference) =>
            reference.name === "groupBy"
              ? invokeGroupBy(self.runner, "Map", args, node)
              : invokeBounded(reference),
          Date: (reference) =>
            reference.name === "now"
              ? Effect.map(DateTime.now, DateTime.toEpochMillis)
              : invokeBounded(reference),
          RegExp: invokeBounded,
          Set: invokeBounded,
          URL: invokeBounded,
          URLSearchParams: invokeBounded,
          Number: invokeBounded,
          String: invokeBounded,
        });
      }
      if (S.is(JsonMethodReference)(callable)) {
        return yield* invokeJsonMethod(self.runner, callable, args, node);
      }
      if (S.is(CoercionFunction)(callable)) {
        return boundedData(invokeCoercion(callable, args, node), `${callable.name} result`);
      }
      if (S.is(UriFunction)(callable)) {
        return invokeUriFunction(callable, args, node);
      }
      if (S.is(SearchFunction)(callable)) {
        return yield* self.invokeSearch(args);
      }
      if (S.is(ErrorConstructorReference)(callable)) {
        const construct = ({ name }: ErrorConstructorReference) =>
          Effect.succeed(constructErrorValue(name, args));

        return yield* ErrorConstructorReference.match(callable, {
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
      if (S.is(GlobalNamespace)(callable)) {
        const requiresNew = (name: string): Effect.Effect<never, InterpreterFailure> =>
          Effect.fail(
            InterpreterRuntimeError.new(`Constructor ${name} requires 'new'.`, node).as("TypeError"),
          );
        const notFunction = (name: string): Effect.Effect<never, InterpreterFailure> =>
          Effect.fail(
            InterpreterRuntimeError.new(`${name} is not a function.`, node).as("TypeError"),
          );

        return yield* GlobalNamespace.match(callable, {
          // Real JS permits calling Array, Object, Date, and RegExp without new.
          Array: () => Effect.succeed(self.constructArray(args, node)),
          Object: () => Effect.succeed(self.constructObject(args, node)),
          // ISO instead of the host's locale string: CodeMode date strings are
          // deterministic and must not leak the host timezone.
          Date: () => Effect.map(DateTime.now, DateTime.formatIso),
          RegExp: () => Effect.sync(() => self.constructRegExp(args, node)),
          Map: ({ name }) => requiresNew(name),
          Set: ({ name }) => requiresNew(name),
          URL: ({ name }) => requiresNew(name),
          URLSearchParams: ({ name }) => requiresNew(name),
          Math: ({ name }) => notFunction(name),
          JSON: ({ name }) => notFunction(name),
          console: ({ name }) => notFunction(name),
        });
      }
      if (S.is(PromiseNamespace)(callable)) {
        throw InterpreterRuntimeError.new("Constructor Promise requires 'new'.", node).as("TypeError");
      }
      if (S.is(SymbolNamespace)(callable)) {
        throw InterpreterRuntimeError.new(
          "Symbol is not callable; only Symbol.asyncIterator and Symbol.iterator are available.",
          node,
        ).as("TypeError");
      }
      if (S.is(PromiseCapabilityFunction)(callable)) {
        callable.settle(args[0]);
        return undefined;
      }
      if (callable === undefined || callable === null) {
        throw InterpreterRuntimeError.new(`${calleeDescription(callee)} is not a function.`, callee).as("TypeError");
      }
      throw InterpreterRuntimeError.new("Only tools are callable here.", callee);
    });
  }

  private invokeObjectMethodOnTools(name: string, ref: ToolReference, node: AstNode): unknown {
    if (name === "keys") {
      return boundedData(this.enumerableKeys(ref)!, "Object.keys result");
    }
    throw InterpreterRuntimeError.new(
      `Object.${name}(...) cannot read tool references: they are not plain data. Use Object.keys(tools) for names, or search({ query }) for signatures.`,
      node,
      "InvalidDataValue",
    );
  }

  private invokeConsole(name: string, args: Array<unknown>, node: AstNode): undefined {
    if (!S.is(consoleMethods)(name)) throw InterpreterRuntimeError.new(`console.${name} is not available.`, node);
    this.logs.push(formatConsoleMessage(name, args));
    return undefined;
  }

  private evaluateCallArguments(argNodes: Array<unknown>): Effect.Effect<Array<unknown>, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      const args = A.empty<unknown>();;
      for (const [index, arg] of argNodes.entries()) {
        const argNode = asNode(arg, `arguments[${index}]`);
        if (argNode.type === "SpreadElement") {
          const spread = yield* self.evaluateExpression(getNode(argNode, "argument"));
          const cursor = yield* self.syncIterator(spread, argNode);
          if (P.isUndefined(cursor))
            throw InterpreterRuntimeError.new("Spread arguments require a synchronous iterable.", argNode).as(
              "TypeError",
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

  private invokeFunction(fn: CodeModeFunction, args: Array<unknown>): Effect.Effect<unknown, InterpreterFailure, R> {
    const invocation = new Interpreter(this.executeTool, this.invokeSearch, this.toolKeys, this.promises, this.logs);
    invocation.scopes = ScopeStack.new(
      A.append(fn.capturedScopes, MutableHashMap.empty())
    );
    const run = Effect.gen(function* () {
      // Seed all parameters first so defaults cannot fall through to same-named outer bindings.
      const paramScope = invocation.scopes.current();
      for (const parameter of fn.parameters) {
        for (const name of collectPatternNames(parameter)) {
          MutableHashMap.set(
            paramScope,
            name,
            Binding.new(true, undefined, false)
          );
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
        const result = yield* invocation.evaluateStatement(fn.body);
        return StatementResult.guards.Return(result)
          ? result.value
          : undefined;
      }

      return yield* invocation.evaluateExpression(fn.body);
    });
    if (fn.generator) {
      return Effect.map(
        Effect.context<R>(),
        (context) => this.createGenerator(invocation, run, fn.async, context),
      );
    }
    if (!fn.async) return run;
    // The initial yield assigns the promise before the body can self-resolve.
    const identity = MutableRef.make<O.Option<CodeModePromise>>(O.none());
    return Effect.map(
      this.createPromise(
        Effect.flatMap(
          run,
          (value) => resolvePromiseValue(invocation.runner, value, fn.body, O.some(identity)),
        ),
      ),
      (promise) => {
        MutableRef.set(identity, O.some(promise));
        return promise;
      },
    );
  }

  private createGenerator(
    invocation: Interpreter<R>,
    run: Effect.Effect<unknown, InterpreterFailure, R>,
    asynchronous: boolean,
    context: Context.Context<R>,
  ): CodeModeGenerator {
    const state: GeneratorState = {
      started: false,
      completed: false,
      draining: false,
      active: O.none(),
      pending: [],
      pendingIndex: 0,
      available: O.none(),
    };
    invocation.generatorState = O.some(state);
    invocation.generatorAsync = asynchronous;
    const requestGenerator = (
      kind: GeneratorRequestKind,
      value: unknown,
      node: AstNode,
    ): Effect.Effect<unknown, InterpreterFailure, R> => {
      const request = {
        kind,
        value,
        response: Deferred.makeUnsafe<unknown, InterpreterFailure>()
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
              .pipe(Effect.ensuring(Effect.sync(() => (state.draining = false)))),
          ),
          Deferred.await(request.response),
        );
      }
      if (state.completed) {
        if (kind === "throw") return Effect.fail(ProgramThrow.new(value));
        return Effect.succeed({
          value: kind === "return" ? value : undefined,
          done: true
        });
      }
      if (!state.started && kind !== "next") {
        state.completed = true;
        if (kind === "throw") return Effect.fail(ProgramThrow.new(value));
        return Effect.succeed({value, done: true});
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
              Effect.flatMap((result) => (asynchronous ? invocation.awaitValue(result) : Effect.succeed(result))),
              Effect.catch((error) =>
                S.is(GeneratorReturn)(error)
                  ? asynchronous
                    ? invocation.awaitValue(error.value)
                    : Effect.succeed(error.value)
                  : Effect.fail(error),
              ),
            ),
          );
          const active = state.active;
          state.active = O.none();
          if (O.isSome(active)) {
            Deferred.doneUnsafe(
              active.value.response,
              Exit.isSuccess(exit) ? Exit.succeed({
                value: exit.value,
                done: true
              }) : exit,
            );
          }
          yield* invocation.completeGeneratorRequests(state, asynchronous);
          state.completed = true;
        });
        return Effect.andThen(this.promises.fork(body), Deferred.await(request.response));
      }
      return Deferred.await(request.response);
    };
    const generator = CodeModeGenerator.new(
      asynchronous,
      (kind, value, node) => Effect.provide(requestGenerator(kind, value, node), context),
    );
    return generator;
  }

  private completeGeneratorRequests(state: GeneratorState, asynchronous: boolean): Effect.Effect<void, never, R> {
    const self = this;
    return Effect.gen(function* () {
      while (true) {
        const pending = self.dequeueGeneratorRequest(state);
        if (P.isUndefined(pending)) return;
        if (pending.kind === "throw") {
          Deferred.doneUnsafe(pending.response, Exit.fail(ProgramThrow.new(pending.value)));
          continue;
        }
        if (asynchronous && pending.kind === "return") {
          const resolved = yield* Effect.exit(self.awaitValue(pending.value));
          Deferred.doneUnsafe(
            pending.response,
            Exit.isSuccess(resolved) ? Exit.succeed({
              value: resolved.value,
              done: true
            }) : resolved,
          );
          continue;
        }
        Deferred.doneUnsafe(
          pending.response,
          Exit.succeed({
            value: pending.kind === "return" ? pending.value : undefined,
            done: true
          }),
        );
      }
    });
  }

  private takeGeneratorRequest(state: GeneratorState): Effect.Effect<GeneratorRequest> {
    const next = this.dequeueGeneratorRequest(state);
    if (P.isNotUndefined(next)) return Effect.succeed(next);
    const available = Deferred.makeUnsafe<void>();
    state.available = O.some(available);
    return Effect.andThen(
      Deferred.await(available),
      Effect.sync(() => this.dequeueGeneratorRequest(state)!),
    );
  }

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

  private suspendGenerator(value: unknown, node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const state = this.generatorState;
    if (O.isNone(state) || O.isNone(state.value.active)) {
      throw InterpreterRuntimeError.new("Generator has no active request.", node);
    }
    Deferred.doneUnsafe(state.value.active.value.response, Exit.succeed({
      value,
      done: false
    }));
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

  private delegateYield(value: unknown, node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      if (
        Array.isArray(value) ||
        typeof value === "string" ||
        value instanceof CodeModeMap ||
        value instanceof CodeModeSet ||
        value instanceof CodeModeURLSearchParams
      ) {
        const cursor = yield* self.syncIterator(value, node);
        if (P.isUndefined(cursor)) throw InterpreterRuntimeError.new("Built-in iterator is unavailable.", node);
        while (true) {
          const step = yield* cursor.next;
          if (step.done) return undefined;
          const resumed = yield* Effect.exit(
            self.suspendGenerator(self.generatorAsync ? yield* self.awaitValue(step.value) : step.value, node),
          );
          if (Exit.isSuccess(resumed)) continue;
          const error = Cause.squash(resumed.cause);
          if (S.is(GeneratorReturn)(error)) {
            yield* cursor.close;
            return yield* Effect.fail(error);
          }
          if (S.is(ProgramThrow)(error)) {
            yield* cursor.close;
            throw InterpreterRuntimeError.new("The delegated iterator does not provide a throw() method.", node).as(
              "TypeError",
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
      let input: unknown = undefined;
      while (true) {
        const method =
          kind === "next"
            ? iterator.next
            : S.is(CodeModeGenerator)(iterator.iterator)
              ? GeneratorMethodReference.new(iterator.iterator, kind)
              : iterator.iterator[kind];
        if (P.isUndefined(method) || P.isNull(method)) {
          if (kind === "return") return yield* Effect.fail(GeneratorReturn.new(input));
          yield* self.closeIterator(iterator, node, self.generatorAsync);
          throw InterpreterRuntimeError.new("The delegated iterator does not provide a throw() method.", node).as(
            "TypeError",
          );
        }
        const called = yield* self.invokeCallable(
          self.requireIteratorMethod(method, `Iterator ${kind}`, node),
          [input],
          node,
        );
        const result = self.requireIteratorObject(
          iterator.asynchronous ? yield* self.awaitValue(called) : called,
          `Iterator ${kind}() result`,
          node,
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

        const resumed: Exit.Exit<unknown, InterpreterFailure> = yield* Effect.exit(self.suspendGenerator(resultValue, node));
        if (Exit.isSuccess(resumed)) {
          kind = "next";
          input = resumed.value;
          continue;
        }
        const error: unknown = Cause.squash(resumed.cause);
        if (!S.is(GeneratorReturn)(error) && !S.is(ProgramThrow)(error)) {
          return yield* Effect.failCause(resumed.cause);
        }
        kind = S.is(GeneratorReturn)(error) ? "return" : "throw";
        input = error.value;
      }
    });
  }

  private evaluateObjectExpression(node: AstNode): Effect.Effect<Record<string, unknown>, InterpreterFailure, R> {
    const objectValue: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    const properties = getArray(node, "properties");
    const self = this;
    return Effect.gen(function* () {
      for (const propertyValue of properties) {
        const property = asNode(propertyValue, "properties");

        if (property.type === "SpreadElement") {
          const spread = yield* self.evaluateExpression(getNode(property, "argument"));
          if (spread === null || spread === undefined || isCodeModeValue(spread)) continue;
          if (typeof spread !== "object" || Array.isArray(spread) || isRuntimeReference(spread)) {
            throw InterpreterRuntimeError.new("Object spread requires a data object.", property, "InvalidDataValue");
          }
          for (const [key, value] of Object.entries(spread)) {
            if (isBlockedMember(key)) throw InterpreterRuntimeError.new(`Property '${key}' is not available.`, property);
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

  private evaluateArrayExpression(node: AstNode): Effect.Effect<Array<unknown>, InterpreterFailure, R> {
    const elements = getArray(node, "elements");
    const values = A.empty<unknown>();;

    const self = this;
    return Effect.gen(function* () {
      for (const elementValue of elements) {
        if (elementValue === null) {
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

  private evaluateTemplateLiteral(node: AstNode): Effect.Effect<string, InterpreterFailure, R> {
    const quasis = getArray(node, "quasis");
    const expressions = getArray(node, "expressions");

    let output = "";

    const self = this;
    return Effect.gen(function* () {
      for (let index = 0; index < quasis.length; index += 1) {
        const quasi = asNode(quasis[index], "quasis");
        const rawValue = quasi.value;

        if (!isRecord(rawValue) || typeof rawValue.cooked !== "string") {
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

  private evaluateConditionalExpression(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    return Effect.flatMap(this.evaluateExpression(getNode(node, "test")), (test) =>
      this.evaluateExpression(getNode(node, P.isTruthy(test) ? "consequent" : "alternate")),
    );
  }

  private applyCompoundAssignment(operator: string, current: unknown, incoming: unknown, node: AstNode): unknown {
    if (!S.is(compoundOperators)(operator)) {
      throw InterpreterRuntimeError.new(`Unsupported assignment operator '${operator}'.`, node);
    }
    return this.applyBinaryOperator(operator.slice(0, -1), current, incoming, node);
  }

  private getMemberReference(
    node: AstNode,
    operation: "read" | "delete" = "read",
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
      if ((objectValue === null || objectValue === undefined) && optional) return OptionalShortCircuit;

      const key = computed
        ? self.toPropertyKey(yield* self.evaluateExpression(propertyNode), propertyNode)
        : propertyNode.type === "Identifier"
          ? getString(propertyNode, "name")
          : self.toPropertyKey(yield* self.evaluateExpression(propertyNode), propertyNode);

      if (S.is(ToolReference)(objectValue)) {
        if (typeof key !== "string") {
          throw InterpreterRuntimeError.new("Tool paths must use string property names.", propertyNode);
        }
        return ToolReference.new(A.append(objectValue.path, key));
      }

      if (S.is(PromiseNamespace)(objectValue)) {
        if (P.isString(key) && S.is(promiseStatics)(key)) {
          return PromiseMethodReference.new(key);
        }
        throw InterpreterRuntimeError.new(
          `Promise.${String(key)} is not available. Available: Promise.all, Promise.allSettled, Promise.race, Promise.any, Promise.resolve, and Promise.reject; consume promises with await.`,
          propertyNode,
        );
      }

      if (S.is(SymbolNamespace)(objectValue)) {
        if (key === "asyncIterator") return ComputedValue.new(AsyncIteratorSymbol);
        if (key === "iterator") return ComputedValue.new(IteratorSymbol);
        return ComputedValue.new(undefined);
      }

      if (S.is(GlobalNamespace)(objectValue)) {
        if (P.isString(key) && isBlockedMember(key)) {
          throw InterpreterRuntimeError.new(`${objectValue.name}.${key} is not available.`, propertyNode);
        }
        if (typeof key !== "string") return ComputedValue.new(undefined);
        const missing = (): ComputedValue => ComputedValue.new(undefined);
        const staticMember = (
          namespace: Exclude<GlobalNamespaceName, "JSON">
        ): ComputedValue | GlobalMethodReference => {
          const staticMembers = globalStaticMembers[namespace];
          return P.isNotUndefined(staticMembers) && S.is(staticMembers)(key)
            ? GlobalMethodReference.new(namespace, key)
            : missing();
        };

        return GlobalNamespace.match(objectValue, {
          Math: () =>
            S.is(mathConstants)(key)
              ? ComputedValue.new((Math as unknown as Record<string, number>)[key])
              : staticMember("Math"),
          JSON: () =>
            S.is(jsonStatics)(key)
              ? JsonMethodReference.new(key)
              : missing(),
          Object: () => staticMember("Object"),
          Array: () => staticMember("Array"),
          console: () => staticMember("console"),
          Date: () => staticMember("Date"),
          RegExp: () => staticMember("RegExp"),
          Map: () => staticMember("Map"),
          Set: () => staticMember("Set"),
          URL: () => staticMember("URL"),
          URLSearchParams: () => staticMember("URLSearchParams"),
        });
      }

      if (typeof objectValue === "string") {
        if (key === "length") return ComputedValue.new(objectValue.length);
        const index = typeof key === "symbol" ? undefined : parseArrayIndex(key);
        if (index !== undefined) return ComputedValue.new(objectValue[index]);
        if (P.isString(key) && S.is(stringMethods)(key)) return IntrinsicReference.new(objectValue, key);
        return ComputedValue.new(undefined);
      }

      if (typeof objectValue === "number") {
        if (P.isString(key) && S.is(numberMethods)(key)) return IntrinsicReference.new(objectValue, key);
        return ComputedValue.new(undefined);
      }

      if (S.is(CoercionFunction)(objectValue)) {
        if (P.isString(key) && isBlockedMember(key)) {
          throw InterpreterRuntimeError.new(`${objectValue.name}.${key} is not available.`, propertyNode);
        }
        if (typeof key !== "string") return ComputedValue.new(undefined);
        const missing = (): ComputedValue => ComputedValue.new(undefined);
        return CoercionFunction.match(objectValue, {
          Number: () => {
            if (S.is(numberConstants)(key)) {
              return ComputedValue.new((Number as unknown as Record<string, number>)[key]);
            }
            return S.is(numberStatics)(key)
              ? GlobalMethodReference.new("Number", key)
              : missing();
          },
          String: () =>
            S.is(stringStatics)(key)
              ? GlobalMethodReference.new("String", key)
              : missing(),
          Boolean: missing,
          parseInt: missing,
          parseFloat: missing,
          isFinite: missing,
          isNaN: missing,
        });
      }

      if (objectValue instanceof CodeModeDate) {
        if (P.isString(key) && S.is(dateMethods)(key)) return IntrinsicReference.new(objectValue, key);
        return ComputedValue.new(undefined);
      }
      if (objectValue instanceof CodeModeRegExp) {
        if (key === "lastIndex") return MemberReference.new(objectValue, key);
        if (P.isString(key) && S.is(regexpProperties)(key)) {
          return ComputedValue.new((objectValue.regex as unknown as Record<string, unknown>)[key]);
        }
        if (P.isString(key) && S.is(regexpMethods)(key)) return IntrinsicReference.new(objectValue, key);
        return ComputedValue.new(undefined);
      }
      if (objectValue instanceof CodeModeMap) {
        if (key === "size") return ComputedValue.new(objectValue.map.size);
        if (P.isString(key) && S.is(mapMethods)(key)) return IntrinsicReference.new(objectValue, key);
        return ComputedValue.new(undefined);
      }
      if (objectValue instanceof CodeModeSet) {
        if (key === "size") return ComputedValue.new(objectValue.set.size);
        if (P.isString(key) && S.is(setMethods)(key)) return IntrinsicReference.new(objectValue, key);
        return ComputedValue.new(undefined);
      }
      if (objectValue instanceof CodeModeURL) {
        if (key === "searchParams") {
          return ComputedValue.new(objectValue.searchParams);
        }
        if (P.isString(key) && S.is(urlMethods)(key)) return IntrinsicReference.new(objectValue, key);
        if (P.isString(key) && S.is(urlProperties)(key)) {
          return MemberReference.new(objectValue, key);
        }
        return ComputedValue.new(undefined);
      }
      if (objectValue instanceof CodeModeURLSearchParams) {
        if (key === "size") return ComputedValue.new(objectValue.params.size);
        if (P.isString(key) && S.is(urlSearchParamsMethods)(key)) {
          return IntrinsicReference.new(objectValue, key);
        }
        return ComputedValue.new(undefined);
      }

      // Reject unknown promise properties so a missing await cannot hide.
      if (objectValue instanceof CodeModePromise) {
        if (key === "then" || key === "catch" || key === "finally") {
          return PromiseInstanceMethodReference.new(objectValue, key);
        }
        throw InterpreterRuntimeError.new(
          "This value is an un-awaited Promise; await it first - e.g. `const result = await tools.ns.tool(...)`.",
          objectNode,
          "InvalidDataValue",
        );
      }

      if (S.is(CodeModeGenerator)(objectValue)) {
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
          "InvalidDataValue",
        );
      }

      if (typeof objectValue !== "object" || objectValue === null) {
        throw InterpreterRuntimeError.new("Cannot access a property on a non-object value.", objectNode);
      }

      if (P.isString(key) && isBlockedMember(key)) {
        throw InterpreterRuntimeError.new(`Property '${key}' is not available.`, propertyNode);
      }

      if (Array.isArray(objectValue)) {
        if (operation === "delete") {
          return MemberReference.new(objectValue, key);
        }
        const index = typeof key === "symbol" ? undefined : parseArrayIndex(key);
        if (key !== "length" && !(P.isString(key) && S.is(arrayMethods)(key)) && index === undefined) {
          if (P.isString(key) && Object.hasOwn(objectValue, key)) {
            return ComputedValue.new((objectValue as Record<string, unknown> & Array<unknown>)[key]);
          }
          return ComputedValue.new(undefined);
        }
        return MemberReference.new(objectValue, index ?? key);
      }

      return MemberReference.new(objectValue as SafeObject, key);
    });
  }

  private readMember(node: AstNode): Effect.Effect<unknown, InterpreterFailure, R> {
    return Effect.map(this.getMemberReference(node), (reference) => {
      if (reference === OptionalShortCircuit) return OptionalShortCircuit;
      if (S.is(ComputedValue)(reference)) return reference.value;
      if (reference === undefined || isOpaqueMemberReference(reference)) return reference;
      if (Array.isArray(reference.target)) {
        if (reference.key === "length") return reference.target.length;
        if (typeof reference.key === "string") return IntrinsicReference.new(reference.target, reference.key);
        return Reflect.get(reference.target, reference.key);
      }
      if (reference.target instanceof CodeModeRegExp) return reference.target.lastIndex;
      if (reference.target instanceof CodeModeURL) {
        return Reflect.get(reference.target.url, reference.key);
      }
      return Reflect.get(reference.target, reference.key);
    });
  }

  private writeMember(node: AstNode, value: unknown): Effect.Effect<unknown, InterpreterFailure, R> {
    return this.modifyMember(node, () => Effect.succeed({
      write: true,
      next: value,
      result: value
    }));
  }

  private evaluateDeleteExpression(argument: AstNode): Effect.Effect<boolean, InterpreterFailure, R> {
    const target = argument.type === "ChainExpression" ? getNode(argument, "expression") : argument;
    if (target.type !== "MemberExpression") {
      throw InterpreterRuntimeError.new("Only data fields may be deleted.", argument);
    }
    return Effect.map(this.getMemberReference(target, "delete"), (reference) => {
      if (reference === OptionalShortCircuit) return true;
      if (
        S.is(ComputedValue)(reference) ||
        reference === undefined ||
        isOpaqueMemberReference(reference) ||
        reference.target instanceof CodeModeURL
      ) {
        throw InterpreterRuntimeError.new("Only data fields may be deleted.", target, "InvalidDataValue");
      }
      if (reference.target instanceof CodeModeRegExp) {
        return Reflect.deleteProperty(reference.target.regex, reference.key);
      }
      return Reflect.deleteProperty(reference.target, reference.key);
    });
  }

  // Resolve side-effecting object and key expressions exactly once.
  private modifyMember(
    node: AstNode,
    compute: (current: unknown) => Effect.Effect<{
      write: boolean;
      next: unknown;
      result: unknown
    }, InterpreterFailure, R>,
  ): Effect.Effect<unknown, InterpreterFailure, R> {
    const self = this;
    return Effect.gen(function* () {
      const reference = yield* self.getMemberReference(node);
      if (
        reference === OptionalShortCircuit ||
        S.is(ComputedValue)(reference) ||
        reference === undefined ||
        isOpaqueMemberReference(reference)
      ) {
        throw InterpreterRuntimeError.new("Only data fields may be assigned.", node);
      }
      if (Array.isArray(reference.target)) {
        if (reference.key === "length") throw InterpreterRuntimeError.new("Array length cannot be assigned.", node);
        if (typeof reference.key === "string" && S.is(arrayMethods)(reference.key)) {
          throw InterpreterRuntimeError.new("Array methods cannot be assigned.", node);
        }
      }
      const key = reference.key;
      const {
        write,
        next,
        result
      } = yield* compute(self.readReferenceValue(reference, key));
      if (write) self.assignToReference(reference, key, next, node);
      return result;
    });
  }

  private readReferenceValue(reference: MemberReference, key: PropertyKey): unknown {
    if (reference.target instanceof CodeModeURL) {
      return Reflect.get(reference.target.url, key);
    }
    if (reference.target instanceof CodeModeRegExp) return reference.target.lastIndex;
    return Reflect.get(reference.target, key);
  }

  private assignToReference(reference: MemberReference, key: PropertyKey, next: unknown, node: AstNode): void {
    if (Array.isArray(reference.target)) {
      const target = reference.target;
      if (typeof key !== "number" || parseArrayIndex(key) === undefined) {
        throw InterpreterRuntimeError.new(
          "Array assignment index must be a valid array index.",
          node,
          "InvalidDataValue",
        );
      }
      rejectCircularInsertion(target, next, "Array assignment result", node);
      target[key] = next;
      return;
    }
    if (reference.target instanceof CodeModeURL) {
      const property = key as string;
      if (!S.is(urlWritableProperties)(property)) {
        throw InterpreterRuntimeError.new(`URL.${property} is read-only.`, node).as("TypeError");
      }
      try {
        const url = reference.target.url as unknown as Record<string, string>;
        url[property] = uriArgument(next, `URL.${property} value`);
        return;
      } catch (error) {
        if (S.is(InterpreterRuntimeError)(error) || S.is(ToolRuntimeError)(error)) throw error;
        throw InterpreterRuntimeError.new(`URL.${property} received an invalid value.`, node).as("TypeError");
      }
    }
    if (reference.target instanceof CodeModeRegExp) {
      reference.target.lastIndex = next;
      return;
    }
    const target = reference.target as SafeObject;
    rejectCircularInsertion(target, next, "Object assignment result", node);
    Reflect.set(target, key, next);
  }

  private toPropertyKey(value: unknown, node: AstNode): PropertyKey {
    if (typeof value === "string" || typeof value === "number") {
      return value;
    }
    if (value === AsyncIteratorSymbol || value === IteratorSymbol) return value;

    throw InterpreterRuntimeError.new(
      "Property key must be a string or number, or Symbol.asyncIterator/Symbol.iterator.",
      node,
    );
  }
}
