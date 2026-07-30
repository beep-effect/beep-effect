import { O } from "@beep/utils";
import { MutableHashMap, type Effect } from "effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "tstyche";
import * as CodeMode from "../Codemode.service.ts";
import { SearchInput, ToolReference } from "../Codemode.tool-runtime.ts";
import {
  Binding,
  CoercionFunction,
  CoercionFunctionName,
  DiagnosticKind,
  ErrorConstructorName,
  ErrorConstructorReference,
  GlobalMethod,
  GlobalMethodReference,
  GlobalNamespace,
  GlobalNamespaceName,
  InterpreterRuntimeError,
  JsonMethodReference,
  JsonMethodName,
  PromiseMethodReference,
  PromiseMethodName,
  RuntimeReference,
  SearchFunction,
  Scope,
  SourceLocation,
  SourcePosition,
  StatementBreak,
  StatementResult,
  UriFunction,
  UriFunctionName,
} from "../interpreter/Interpreter.model.ts";
import {
  ApiKeyCarrier,
  ApiKeyHeader,
  ApiPath,
  FromSpecResult,
  HttpMethod,
  InvalidOpenApiOptions,
  Operation,
  OperationId,
} from "../openapi/OpenAPI.types.ts";
import * as OpenAPI from "../openapi/index.ts";

describe("CodeMode public types", () => {
  it("preserves positional class constructors", () => {
    const start = SourcePosition.new(1, 0);
    const end = SourcePosition.new(1, 4);

    expect(start).type.toBe<SourcePosition>();
    expect(SourceLocation.new(start, end)).type.toBe<SourceLocation>();
    expect(SearchInput.new("users", "users", 5, 0)).type.toBe<SearchInput>();
    expect(ToolReference.new(["users", "get"])).type.toBe<ToolReference>();
    expect(SearchFunction.new()).type.toBe<SearchFunction>();
    expect(InterpreterRuntimeError.new("boom")).type.toBe<InterpreterRuntimeError>();
    expect(Binding.new(true, 1)).type.toBe<Binding>();
    expect(
      MutableHashMap.empty<string, Binding>().pipe(S.decodeUnknownSync(Scope))
    ).type.toBe<Scope>();
    expect(StatementBreak.new("outer")).type.toBe<StatementBreak>();
    expect(CoercionFunction.new("Number")).type.toBe<CoercionFunction>();
    expect(PromiseMethodReference.new("all")).type.toBe<PromiseMethodReference>();
    expect(GlobalNamespace.new("JSON")).type.toBe<GlobalNamespace>();
    expect(
      GlobalMethodReference.new(GlobalMethod.cases.String.make({ name: "fromCodePoint" }))
    ).type.toBe<GlobalMethodReference>();
    expect(JsonMethodReference.new("parse")).type.toBe<JsonMethodReference>();
    expect(UriFunction.new("encodeURIComponent")).type.toBe<UriFunction>();
    expect(ErrorConstructorReference.new("TypeError")).type.toBe<ErrorConstructorReference>();
  });

  it("preserves Effect error and requirement channels", () => {
    expect(CodeMode.resolveExecutionLimits()).type.toBe<
      Effect.Effect<CodeMode.ExecutionLimits, CodeMode.InvalidExecutionLimits, never>
    >();
    expect(CodeMode.execute({ code: "return 1" })).type.toBe<
      Effect.Effect<CodeMode.Result, CodeMode.InvalidExecutionLimits, never>
    >();
    expect(OpenAPI.fromSpec({ spec: {} })).type.toBe<
      Effect.Effect<FromSpecResult, InvalidOpenApiOptions, never>
    >();
  });

  it("preserves mapped literal encoded and decoded domains", () => {
    const method = S.decodeUnknownSync(HttpMethod)("get");
    const path = S.decodeUnknownSync(ApiPath)("/users");
    const operationId = S.decodeUnknownSync(OperationId)("getUsers");
    const operation = Operation.new(
      O.some(operationId),
      method,
      path,
      O.none(),
      O.none()
    );

    expect<HttpMethod>().type.toBe<
      "GET" | "PUT" | "POST" | "DELETE" | "OPTIONS" | "HEAD" | "PATCH" | "TRACE"
    >();
    expect<typeof HttpMethod.Encoded>().type.toBe<
      "get" | "put" | "post" | "delete" | "options" | "head" | "patch" | "trace"
    >();
    expect(S.encodeEffect(HttpMethod)(method)).type.toBe<
      Effect.Effect<typeof HttpMethod.Encoded, S.SchemaError, never>
    >();
    expect(operation).type.toBe<Operation>();
  });

  it("narrows schema-owned tagged unions", () => {
    const carrier = ApiKeyHeader.new("X-API-Key");
    const reference: RuntimeReference = SearchFunction.new();

    expect(ApiKeyCarrier.guards.header(carrier)).type.toBe<boolean>();
    expect(
      ApiKeyCarrier.match(carrier, {
        header: ({ name }) => name,
        query: ({ name }) => name,
        cookie: ({ name }) => name,
      })
    ).type.toBe<ApiKeyHeader["name"]>();
    expect(RuntimeReference.guards.SearchFunction(reference)).type.toBe<boolean>();
    expect(DiagnosticKind.Enum.ExecutionFailure).type.toBe<"ExecutionFailure">();

    const coercion = CoercionFunction.new("parseFloat");
    const statement: StatementResult = StatementBreak.new();

    expect(
      CoercionFunctionName.$match(coercion.name, {
        Boolean: () => coercion.name,
        Number: () => coercion.name,
        String: () => coercion.name,
        isFinite: () => coercion.name,
        isNaN: () => coercion.name,
        parseInt: () => coercion.name,
        parseFloat: () => coercion.name,
      })
    ).type.toBe<CoercionFunctionName>();
    expect(StatementResult.guards.Break(statement)).type.toBe<boolean>();
    const promiseMethod = PromiseMethodReference.new("allSettled");

    expect(
      PromiseMethodName.$match(promiseMethod.name, {
        all: () => promiseMethod.name,
        allSettled: () => promiseMethod.name,
        race: () => promiseMethod.name,
        any: () => promiseMethod.name,
        resolve: () => promiseMethod.name,
        reject: () => promiseMethod.name,
      })
    ).type.toBe<PromiseMethodName>();
    expect(GlobalNamespaceName.is.JSON(GlobalNamespace.new("JSON").name)).type.toBe<boolean>();
    expect(
      GlobalMethod.guards.String(
        GlobalMethodReference.new(
          GlobalMethod.cases.String.make({ name: "fromCodePoint" })
        ).method
      )
    ).type.toBe<boolean>();
    expect(JsonMethodName.is.parse(JsonMethodReference.new("parse").name)).type.toBe<boolean>();
    expect(
      UriFunctionName.is.encodeURIComponent(UriFunction.new("encodeURIComponent").name)
    ).type.toBe<boolean>();
    expect(
      ErrorConstructorName.is.TypeError(ErrorConstructorReference.new("TypeError").name)
    ).type.toBe<boolean>();
    expect(
      StatementResult.match(statement, {
        None: (): string => "none",
        Return: (): string => "return",
        Break: (): string => "break",
        Continue: (): string => "continue",
      })
    ).type.toBe<string>();
  });
});
