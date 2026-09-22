import { fcRuns } from "@beep/test-utils";
import { A, N, O, Str } from "@beep/utils";
import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, pipe, Result as Rs } from "effect";
import * as S from "effect/Schema";
import {
  DiagnosticLocation,
  DiagnosticModel,
  ExecutionLimits,
  execute,
  make,
  Result,
  ResultModel,
  SuccessModel,
} from "../../codemode/Codemode.service.ts";
import * as ToolRuntime from "../../codemode/Codemode.tool-runtime.ts";
import { CopyOutMode, copyIn, copyOut, SearchInput, ToolCallEnded } from "../../codemode/Codemode.tool-runtime.ts";
import { CodeModeDate, CodeModeNumber } from "../../codemode/Codemode.values.ts";
import { IdentifierSegment, identifierSegment } from "../../codemode/Codemode.tool-schema.ts";
import {
  Binding,
  CodeModeGenerator,
  CoercionFunction,
  CoercionFunctionName,
  ErrorConstructorName,
  ErrorConstructorReference,
  GeneratorMethodKind,
  GeneratorMethodReference,
  GlobalMethod,
  GlobalMethodReference,
  GlobalNamespace,
  GlobalNamespaceName,
  IntrinsicReference,
  IntrinsicMethod,
  tryInterpreter,
  unsupportedSyntax,
  JsonMethodName,
  JsonMethodReference,
  MemberReference,
  PromiseMethodName,
  PromiseMethodReference,
  Scope,
  StatementBreak,
  StatementResult,
  UriFunction,
  UriFunctionName,
} from "../../codemode/interpreter/Interpreter.model.ts";
import {
  ApiKeyCarrier,
  ApiKeyHeader,
  ApiKeyQuery,
  ApiPath,
  Credential,
  HttpMethod,
  Operation,
  OperationId,
  SecurityScheme,
  SecuritySchemeApiKey,
} from "../../codemode/openapi/OpenAPI.types.ts";
import { executeWithLimits } from "../../codemode/interpreter/Interpreter.execute.ts";
import { resolvePromiseValue } from "../../codemode/interpreter/Interpreter.promises.ts";
import { invokeDateMethod } from "../../codemode/stdlib/StdLib.date.ts";
import { toHostRegex } from "../../codemode/stdlib/StdLib.regexp.ts";
const decodeExecutionLimits = S.decodeEffect(ExecutionLimits);
const decodeSearchInput = S.decodeEffect(SearchInput);
const decodeUnknownApiPathResult = S.decodeUnknownResult(ApiPath);
const decodeUnknownDiagnosticLocationResult = S.decodeUnknownResult(DiagnosticLocation);
const decodeUnknownExecutionLimitsResult = S.decodeUnknownResult(ExecutionLimits);
const decodeUnknownGlobalMethodReferenceResult = S.decodeUnknownResult(GlobalMethodReference);
const decodeUnknownIdentifierSegmentResult = S.decodeUnknownResult(IdentifierSegment);
const decodeUnknownIntrinsicReferenceResult = S.decodeUnknownResult(IntrinsicReference);
const decodeUnknownOperationIdResult = S.decodeUnknownResult(OperationId);
const decodeUnknownToolCallEndedResult = S.decodeUnknownResult(ToolCallEnded);
const encodeDiagnosticModel = S.encodeEffect(DiagnosticModel);
const encodeExecutionLimits = S.encodeEffect(ExecutionLimits);
const encodeSearchInput = S.encodeEffect(SearchInput);
const encodeStatementBreak = S.encodeEffect(StatementBreak);
const isApiPath2 = S.is(ApiPath);
const isIdentifierSegment = S.is(IdentifierSegment);
const isMemberReference = S.is(MemberReference);
const isResult = S.is(Result);
const isInt = S.is(S.Int);

const assertSchemaArbitraryRoundTrip = <Schema extends S.Codec<unknown>>(
  name: string,
  schema: Schema,
  runs = 40
): void => {
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  const equivalent = S.toEquivalence(schema);

  it.effect.prop(
    `round-trips ${name}`,
    [schema],
    Effect.fnUntraced(function* ([value]) {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      expect(equivalent(decoded, value)).toBe(true);
    }),
    { arbitrary: fcRuns(runs) }
  );
};

describe("CodeMode schema laws", () => {
  it.effect(
    "preserves finite and non-finite guest numbers while rejecting other values",
    Effect.fnUntraced(function* () {
      for (const value of [0, -0, 42, NaN, Infinity, -Infinity]) {
        expect(yield* S.decodeEffect(CodeModeNumber)(value)).toBe(value);
        const date = yield* S.decodeEffect(CodeModeDate)({ _tag: "CodeModeDate", time: value });
        expect(date.time).toBe(value);
        const method = yield* S.decodeEffect(IntrinsicMethod)({
          receiverKind: "Number",
          receiver: value,
          name: "toString",
        });
        expect(method.receiver).toBe(value);
      }
      for (const value of ["1", null, undefined, {}, true]) {
        expect(Rs.isFailure(yield* S.decodeUnknownEffect(CodeModeNumber)(value).pipe(Effect.result))).toBe(true);
      }
    })
  );

  it.effect(
    "supports both execution forms with omitted, supplied, and undefined prepared indexes",
    Effect.fnUntraced(function* () {
      const limits = yield* decodeExecutionLimits({});
      const options = { code: "return 42", toolkit: ToolRuntime.emptyToolkit };
      const expected = SuccessModel.make({ value: 42, toolCalls: [] });
      expect(yield* executeWithLimits(options, limits)).toEqual(expected);
      expect(yield* pipe(options, executeWithLimits(limits))).toEqual(expected);
      expect(yield* executeWithLimits(options, limits, [])).toEqual(expected);
      expect(yield* pipe(options, executeWithLimits(limits, []))).toEqual(expected);
      expect(yield* executeWithLimits(options, limits, undefined)).toEqual(expected);
      expect(yield* pipe(options, executeWithLimits(limits, undefined))).toEqual(expected);
    })
  );

  it.effect(
    "supports both runtime factory forms with optional hooks",
    Effect.fnUntraced(function* () {
      const toolkit = ToolRuntime.emptyToolkit;
      const handlers = yield* toolkit;
      const index = (yield* Effect.fromResult(ToolRuntime.prepare(toolkit))).searchIndex;
      const direct = yield* ToolRuntime.make(toolkit, handlers, O.none(), index);
      const curried = yield* pipe(toolkit, ToolRuntime.make(handlers, O.none(), index));
      const directHooks = yield* ToolRuntime.make(toolkit, handlers, O.none(), index, {});
      const curriedHooks = yield* pipe(toolkit, ToolRuntime.make(handlers, O.none(), index, {}));
      const directUndefined = yield* ToolRuntime.make(toolkit, handlers, O.none(), index, undefined);
      const curriedUndefined = yield* pipe(toolkit, ToolRuntime.make(handlers, O.none(), index, undefined));
      for (const runtime of [direct, curried, directHooks, curriedHooks, directUndefined, curriedUndefined]) {
        expect(runtime.keys([])).toEqual([]);
        expect(yield* runtime.calls).toEqual([]);
      }
    })
  );

  it.effect(
    "supports both promise-resolution forms with optional identity",
    Effect.fnUntraced(function* () {
      const runner = {
        invokeFunction: () => Effect.void,
        invokeCallable: () => Effect.void,
        settlePromise: () => Effect.void,
      };
      const node = { type: "Identifier" };
      expect(yield* resolvePromiseValue(runner, 42, node)).toBe(42);
      expect(yield* pipe(runner, resolvePromiseValue(42, node))).toBe(42);
      expect(yield* resolvePromiseValue(runner, 42, node, O.none())).toBe(42);
      expect(yield* pipe(runner, resolvePromiseValue(42, node, O.none()))).toBe(42);
      expect(yield* resolvePromiseValue(runner, 42, node, undefined)).toBe(42);
      expect(yield* pipe(runner, resolvePromiseValue(42, node, undefined))).toBe(42);
    })
  );

  it("supports data-first and data-last optional-argument helpers", () => {
    const node = { type: "Identifier" };
    const date = CodeModeDate.make({ time: 0 });
    expect(copyIn("text", "label")).toBe("text");
    expect(pipe("text", copyIn("label"))).toBe("text");
    expect(pipe("text", copyIn("label", undefined))).toBe(copyIn("text", "label", undefined));
    expect(copyIn(date, "date", true)).toBe(date);
    expect(pipe(date, copyIn("date", true))).toBe(date);
    expect(toHostRegex("a", "match", node).source).toBe("a");
    expect(pipe("a", toHostRegex("match", node)).source).toBe("a");
    expect(toHostRegex("a", "match", node, "g").flags).toBe("g");
    expect(pipe("a", toHostRegex("match", node, "g")).flags).toBe("g");
    expect(tryInterpreter(() => 42)).toEqual(Rs.succeed(42));
    expect(pipe(() => 42, tryInterpreter())).toEqual(Rs.succeed(42));
    expect(pipe(() => 42, tryInterpreter(node))).toEqual(tryInterpreter(() => 42, node));
    expect(pipe(date, invokeDateMethod("getTime", [], node))).toBe(invokeDateMethod(date, "getTime", [], node));
    expect(pipe(date, invokeDateMethod("getTime", [], node, 123))).toBe(
      invokeDateMethod(date, "getTime", [], node, 123)
    );
    expect(pipe("ClassDeclaration", unsupportedSyntax(node)).message).toBe(
      unsupportedSyntax("ClassDeclaration", node).message
    );
  });

  it("rejects sparse arrays whose declared length exceeds the result boundary", () => {
    const sparse = new Array(100_001);

    expect(() => copyOut(sparse, CopyOutMode.Enum.json)).toThrow(/100000-item boundary limit/u);
  });

  it("supports direct and pipeable copy-out calls", () => {
    expect(copyOut(undefined, CopyOutMode.Enum.nullify)).toBeNull();
    expect(pipe(undefined, copyOut(CopyOutMode.Enum.nullify))).toBeNull();
  });

  describe("derives warning-free arbitraries for every checked string domain", () => {
    assertSchemaArbitraryRoundTrip("IdentifierSegment", IdentifierSegment);
    assertSchemaArbitraryRoundTrip("ApiPath", ApiPath);
    assertSchemaArbitraryRoundTrip("OperationId", OperationId);
    assertSchemaArbitraryRoundTrip("HttpMethod", HttpMethod);
  });

  describe("round-trips defaulted classes and nested tagged unions", () => {
    assertSchemaArbitraryRoundTrip("ExecutionLimits", ExecutionLimits);
    assertSchemaArbitraryRoundTrip("SearchInput", SearchInput);
    assertSchemaArbitraryRoundTrip("Binding", Binding);
    assertSchemaArbitraryRoundTrip("Scope", Scope);
    assertSchemaArbitraryRoundTrip("StatementResult", StatementResult);
    assertSchemaArbitraryRoundTrip("CoercionFunction", CoercionFunction);
    assertSchemaArbitraryRoundTrip("PromiseMethodReference", PromiseMethodReference);
    assertSchemaArbitraryRoundTrip("GlobalNamespace", GlobalNamespace);
    assertSchemaArbitraryRoundTrip("GlobalMethodReference", GlobalMethodReference);
    assertSchemaArbitraryRoundTrip("JsonMethodReference", JsonMethodReference);
    assertSchemaArbitraryRoundTrip("UriFunction", UriFunction);
    assertSchemaArbitraryRoundTrip("ErrorConstructorReference", ErrorConstructorReference);
    assertSchemaArbitraryRoundTrip("Operation", Operation);
    assertSchemaArbitraryRoundTrip("ApiKeyCarrier", ApiKeyCarrier);
    assertSchemaArbitraryRoundTrip("SecurityScheme", SecurityScheme);
    assertSchemaArbitraryRoundTrip("Credential", Credential);
    assertSchemaArbitraryRoundTrip("DiagnosticModel", DiagnosticModel);
    assertSchemaArbitraryRoundTrip("ResultModel", ResultModel);
  });

  it.effect(
    "keeps identifier and path checks at the schema boundary",
    Effect.fnUntraced(function* () {
      assert.strictEqual(identifierSegment("$valid_1"), true);
      assert.strictEqual(identifierSegment("1invalid"), false);
      assert.strictEqual(Rs.isFailure(decodeUnknownIdentifierSegmentResult("with-dash")), true);
      assert.strictEqual(Rs.isFailure(decodeUnknownIdentifierSegmentResult("")), true);
      assert.strictEqual(Rs.isSuccess(decodeUnknownApiPathResult("/users/{id}")), true);
      assert.strictEqual(Rs.isFailure(decodeUnknownApiPathResult("users/{id}")), true);
      assert.strictEqual(Rs.isFailure(decodeUnknownOperationIdResult("   ")), true);
      assert.strictEqual(yield* S.decodeEffect(OperationId)("  getUser  "), "getUser");
    })
  );

  it.effect.prop(
    "keeps string-domain checks equivalent to their defining laws",
    [S.String],
    Effect.fnUntraced(function* ([candidate]) {
      expect(isIdentifierSegment(candidate)).toBe(/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(candidate));
      expect(isApiPath2(candidate)).toBe(/^\/.*$/u.test(candidate));
      const trimmed = Str.trim(candidate);
      const decoded = yield* S.decodeEffect(OperationId)(candidate).pipe(Effect.result);
      expect(Str.isEmpty(trimmed) ? Rs.isFailure(decoded) : Rs.isSuccess(decoded) && decoded.success === trimmed).toBe(
        true
      );
    }),
    { arbitrary: fcRuns(200) }
  );

  it.effect("decodes defaults once and keeps absent Option fields off the wire", () =>
    Effect.gen(function* () {
      const limits = yield* decodeExecutionLimits({});
      const search = yield* decodeSearchInput({});

      assert.strictEqual(O.isNone(limits.timeoutMs), true);
      assert.strictEqual(O.isNone(limits.maxToolCalls), true);
      assert.strictEqual(O.isNone(limits.maxOutputBytes), true);
      expect(yield* encodeExecutionLimits(limits)).toEqual({});

      assert.strictEqual(O.isNone(search.query), true);
      assert.strictEqual(O.isNone(search.namespace), true);
      assert.strictEqual(search.limit, 10);
      assert.strictEqual(search.offset, 0);
      expect(yield* encodeSearchInput(search)).toEqual({ limit: 10, offset: 0 });
    })
  );

  it("rejects unsafe execution limits through schema checks", () => {
    assert.strictEqual(Rs.isFailure(decodeUnknownExecutionLimitsResult({ timeoutMs: 0 })), true);
    assert.strictEqual(Rs.isFailure(decodeUnknownExecutionLimitsResult({ timeoutMs: 1.5 })), true);
    assert.strictEqual(Rs.isFailure(decodeUnknownExecutionLimitsResult({ maxToolCalls: -1 })), true);
    assert.strictEqual(Rs.isFailure(decodeUnknownExecutionLimitsResult({ maxOutputBytes: Number.NaN })), true);
  });

  it("enforces one-based diagnostics and exhaustive reference pairs", () => {
    assert.strictEqual(Rs.isFailure(decodeUnknownDiagnosticLocationResult({ line: 0, column: 1 })), true);
    assert.strictEqual(Rs.isFailure(decodeUnknownDiagnosticLocationResult({ line: 1, column: 0 })), true);
    assert.strictEqual(Rs.isSuccess(decodeUnknownDiagnosticLocationResult({ line: 1, column: 1 })), true);
    assert.strictEqual(
      Rs.isFailure(
        decodeUnknownIntrinsicReferenceResult({
          _tag: "IntrinsicReference",
          method: {
            receiverKind: "String",
            receiver: "value",
            name: "map",
          },
        })
      ),
      true
    );
    assert.strictEqual(
      Rs.isFailure(
        decodeUnknownGlobalMethodReferenceResult({
          _tag: "GlobalMethodReference",
          method: {
            namespace: "String",
            name: "groupBy",
          },
        })
      ),
      true
    );
  });

  it.effect(
    "encodes both internal result variants at public execution boundaries",
    Effect.fnUntraced(function* () {
      const success = yield* execute({ code: 'return "done"' });
      const runtime = yield* make({});
      const failure = yield* runtime.execute("");

      expect(success).toEqual({ ok: true, value: "done", toolCalls: [] });
      expect(failure).toEqual({
        ok: false,
        error: { kind: "ParseError", message: "Code cannot be empty." },
        toolCalls: [],
      });
      assert.strictEqual(isResult(success), true);
      assert.strictEqual(isResult(failure), true);
    })
  );

  it("rejects invalid terminal tool observations", () => {
    assert.strictEqual(
      Rs.isFailure(
        decodeUnknownToolCallEndedResult({
          _tag: "failure",
          index: 0,
          name: "search",
          input: {},
          durationMs: 1,
        })
      ),
      true
    );
    assert.strictEqual(
      Rs.isFailure(
        decodeUnknownToolCallEndedResult({
          _tag: "success",
          index: 0,
          name: "search",
          input: {},
          durationMs: 1,
          message: "impossible",
        })
      ),
      true
    );
    assert.strictEqual(
      Rs.isFailure(
        decodeUnknownToolCallEndedResult({
          _tag: "success",
          index: 0,
          name: " ",
          input: {},
          durationMs: 1,
        })
      ),
      true
    );
  });

  it.effect.prop(
    "keeps numeric execution-limit checks equivalent to positive and non-negative integers",
    [S.Finite],
    Effect.fnUntraced(function* ([value]) {
      const timeout = yield* S.decodeEffect(ExecutionLimits)({ timeoutMs: value }).pipe(Effect.result);
      const toolCalls = yield* S.decodeEffect(ExecutionLimits)({ maxToolCalls: value }).pipe(Effect.result);
      expect(Rs.isSuccess(timeout)).toBe(isInt(value) && N.isGreaterThan(0)(value));
      expect(Rs.isSuccess(toolCalls)).toBe(isInt(value) && N.isGreaterThanOrEqualTo(0)(value));
    }),
    { arbitrary: fcRuns(200) }
  );

  it.effect("constructs and matches interpreter tagged unions through schema statics", () =>
    Effect.gen(function* () {
      const coercion = CoercionFunction.new("parseInt");
      const promiseMethod = PromiseMethodReference.new("allSettled");
      const globalNamespace = GlobalNamespace.new("JSON");
      const globalMethod = GlobalMethodReference.new(GlobalMethod.cases.String.make({ name: "fromCodePoint" }));
      const jsonMethod = JsonMethodReference.new("stringify");
      const uriFunction = UriFunction.new("decodeURIComponent");
      const errorConstructor = ErrorConstructorReference.new("AggregateError");
      const generatorMethod = GeneratorMethodReference.new(
        CodeModeGenerator.new(false, () => Effect.void),
        "iterator"
      );
      const statement = StatementBreak.new("outer");
      const target = [1, 2, 3];
      const member = MemberReference.new(target, 1);

      assert.strictEqual(
        CoercionFunctionName.$match(coercion.name, {
          Boolean: () => coercion.name,
          Number: () => coercion.name,
          String: () => coercion.name,
          isFinite: () => coercion.name,
          isNaN: () => coercion.name,
          parseInt: () => coercion.name,
          parseFloat: () => coercion.name,
        }),
        "parseInt"
      );
      assert.strictEqual(
        PromiseMethodName.$match(promiseMethod.name, {
          all: () => promiseMethod.name,
          allSettled: () => promiseMethod.name,
          race: () => promiseMethod.name,
          any: () => promiseMethod.name,
          resolve: () => promiseMethod.name,
          reject: () => promiseMethod.name,
        }),
        "allSettled"
      );
      assert.strictEqual(GlobalNamespaceName.is.JSON(globalNamespace.name), true);
      assert.strictEqual(GlobalMethod.guards.String(globalMethod.method), true);
      assert.strictEqual(JsonMethodName.is.stringify(jsonMethod.name), true);
      assert.strictEqual(UriFunctionName.is.decodeURIComponent(uriFunction.name), true);
      assert.strictEqual(ErrorConstructorName.is.AggregateError(errorConstructor.name), true);
      assert.strictEqual(GeneratorMethodKind.is.iterator(generatorMethod.kind), true);
      assert.strictEqual(isMemberReference(member), true);
      assert.strictEqual(member.target, target);
      assert.strictEqual(StatementResult.guards.Break(statement), true);
      expect(yield* encodeStatementBreak(statement)).toEqual({
        _tag: "Break",
        label: "outer",
      });
      expect(yield* encodeStatementBreak(StatementBreak.new())).toEqual({
        _tag: "Break",
      });
    })
  );

  it("matches nested OpenAPI tagged unions without switch statements", () => {
    const scheme = SecuritySchemeApiKey.new(ApiKeyQuery.new("api_key"));
    const rendered = SecurityScheme.match(scheme, {
      apiKey: ({ carrier }) =>
        ApiKeyCarrier.match(carrier, {
          header: ({ name }) => `header:${name}`,
          query: ({ name }) => `query:${name}`,
          cookie: ({ name }) => `cookie:${name}`,
        }),
      http: ({ scheme: name }) => `http:${name}`,
      oauth2: () => "oauth2",
      openIdConnect: () => "openIdConnect",
    });

    assert.strictEqual(rendered, "query:api_key");
    assert.strictEqual(ApiKeyCarrier.guards.header(ApiKeyHeader.new("X-API-Key")), true);
    assert.strictEqual(ApiKeyCarrier.isAnyOf(A.make("query", "cookie"))(ApiKeyHeader.new("X-API-Key")), false);
  });

  it.effect("encodes diagnostic defaults as a wire-compatible tagged object", () =>
    Effect.gen(function* () {
      const diagnostic = DiagnosticModel.new("ParseError", "Unexpected token");

      expect(yield* encodeDiagnosticModel(diagnostic)).toEqual({
        kind: "ParseError",
        message: "Unexpected token",
      });
      assert.strictEqual(diagnostic.message, "Unexpected token");
    })
  );
});
