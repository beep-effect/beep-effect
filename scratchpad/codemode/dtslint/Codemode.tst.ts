import { O } from "@beep/utils";
import { MutableHashMap, type Effect } from "effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "tstyche";
import * as CodeMode from "../Codemode.service.ts";
import {
  SearchInput,
  ToolCallEnded,
  ToolCallStarted,
  ToolReference,
} from "../Codemode.tool-runtime.ts";
import {
  Binding,
  CoercionFunction,
  type CoercionFunctionName,
  DiagnosticKind,
  ErrorConstructorReference,
  GlobalMethodReference,
  GlobalNamespace,
  InterpreterRuntimeError,
  JsonMethodReference,
  PromiseMethodReference,
  type PromiseMethodName,
  RuntimeReference,
  SearchFunction,
  Scope,
  SourceLocation,
  SourcePosition,
  StatementBreak,
  StatementResult,
  UriFunction,
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
    const call = ToolCallStarted.new(0, "users.get", { id: "1" });

    expect(start).type.toBe<SourcePosition>();
    expect(SourceLocation.new(start, end)).type.toBe<SourceLocation>();
    expect(SearchInput.new("users", "users", 5, 0)).type.toBe<SearchInput>();
    expect(ToolReference.new(["users", "get"])).type.toBe<ToolReference>();
    expect(ToolCallEnded.new(call, 10, "success")).type.toBe<ToolCallEnded>();
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
    expect(GlobalMethodReference.new("String", "fromCodePoint")).type.toBe<GlobalMethodReference>();
    expect(JsonMethodReference.new("parse")).type.toBe<JsonMethodReference>();
    expect(UriFunction.new("encodeURIComponent")).type.toBe<UriFunction>();
    expect(ErrorConstructorReference.new("TypeError")).type.toBe<ErrorConstructorReference>();
  });

  it("preserves Effect error and requirement channels", () => {
    expect(CodeMode.resolveExecutionLimits()).type.toBe<
      Effect.Effect<CodeMode.ResolvedExecutionLimits, CodeMode.InvalidExecutionLimits, never>
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
      CoercionFunction.match(coercion, {
        Boolean: ({ name }) => name,
        Number: ({ name }) => name,
        String: ({ name }) => name,
        isFinite: ({ name }) => name,
        isNaN: ({ name }) => name,
        parseInt: ({ name }) => name,
        parseFloat: ({ name }) => name,
      })
    ).type.toBe<CoercionFunctionName>();
    expect(StatementResult.guards.Break(statement)).type.toBe<boolean>();
    const promiseMethod = PromiseMethodReference.new("allSettled");

    expect(
      PromiseMethodReference.match(promiseMethod, {
        all: ({ name }) => name,
        allSettled: ({ name }) => name,
        race: ({ name }) => name,
        any: ({ name }) => name,
        resolve: ({ name }) => name,
        reject: ({ name }) => name,
      })
    ).type.toBe<PromiseMethodName>();
    expect(GlobalNamespace.guards.JSON(GlobalNamespace.new("JSON"))).type.toBe<boolean>();
    expect(
      GlobalMethodReference.guards.String(
        GlobalMethodReference.new("String", "fromCodePoint")
      )
    ).type.toBe<boolean>();
    expect(JsonMethodReference.guards.parse(JsonMethodReference.new("parse"))).type.toBe<boolean>();
    expect(
      UriFunction.guards.encodeURIComponent(UriFunction.new("encodeURIComponent"))
    ).type.toBe<boolean>();
    expect(
      ErrorConstructorReference.guards.TypeError(
        ErrorConstructorReference.new("TypeError")
      )
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
