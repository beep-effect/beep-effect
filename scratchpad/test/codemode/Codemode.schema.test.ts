import { fcRuns } from "@beep/test-utils";
import { A, N, O, Str } from "@beep/utils";
import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, pipe, Result as Rs } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import {
  DiagnosticLocation,
  DiagnosticModel,
  ExecutionLimits,
  execute,
  make,
  Result,
  ResultModel,
} from "../../codemode/Codemode.service.ts";
import { CopyOutMode, copyOut, SearchInput, ToolCallEnded } from "../../codemode/Codemode.tool-runtime.ts";
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
const decodeExecutionLimitsSync = S.decodeSync(ExecutionLimits);
const decodeSearchInputSync = S.decodeSync(SearchInput);
const decodeUnknownApiPathResult = S.decodeUnknownResult(ApiPath);
const decodeUnknownDiagnosticLocationResult = S.decodeUnknownResult(DiagnosticLocation);
const decodeUnknownExecutionLimitsResult = S.decodeUnknownResult(ExecutionLimits);
const decodeUnknownGlobalMethodReferenceResult = S.decodeUnknownResult(GlobalMethodReference);
const decodeUnknownIdentifierSegmentResult = S.decodeUnknownResult(IdentifierSegment);
const decodeUnknownIntrinsicReferenceResult = S.decodeUnknownResult(IntrinsicReference);
const decodeUnknownOperationIdResult = S.decodeUnknownResult(OperationId);
const decodeUnknownToolCallEndedResult = S.decodeUnknownResult(ToolCallEnded);
const encodeDiagnosticModelSync = S.encodeSync(DiagnosticModel);
const encodeExecutionLimitsSync = S.encodeSync(ExecutionLimits);
const encodeSearchInputSync = S.encodeSync(SearchInput);
const encodeStatementBreakSync = S.encodeSync(StatementBreak);
const isApiPath2 = S.is(ApiPath);
const isIdentifierSegment = S.is(IdentifierSegment);
const isMemberReference = S.is(MemberReference);
const isResult = S.is(Result);
const isInt = S.is(S.Int);

const assertSchemaArbitraryRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, runs = 40): void => {
  const derived = Arbitrary.schema(schema);
  const encode = S.encodeUnknownResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);

  expect(
    Effect.runSync(
      Arbitrary.checkEffect(
        Arbitrary.all([derived]),
        ([value]) => equivalent(Rs.getOrThrow(decode(Rs.getOrThrow(encode(value)))), value),
        fcRuns(runs)
      )
    )._tag
  ).toBe("Passed");
};

describe("CodeMode schema laws", () => {
  it("rejects sparse arrays whose declared length exceeds the result boundary", () => {
    const sparse = new Array(100_001);

    expect(() => copyOut(sparse, CopyOutMode.Enum.json)).toThrow(/100000-item boundary limit/u);
  });

  it("supports direct and pipeable copy-out calls", () => {
    expect(copyOut(undefined, CopyOutMode.Enum.nullify)).toBeNull();
    expect(pipe(undefined, copyOut(CopyOutMode.Enum.nullify))).toBeNull();
  });

  it("derives warning-free arbitraries for every checked string domain", () => {
    assertSchemaArbitraryRoundTrip(IdentifierSegment);
    assertSchemaArbitraryRoundTrip(ApiPath);
    assertSchemaArbitraryRoundTrip(OperationId);
    assertSchemaArbitraryRoundTrip(HttpMethod);
  });

  it("round-trips defaulted classes and nested tagged unions", () => {
    assertSchemaArbitraryRoundTrip(ExecutionLimits);
    assertSchemaArbitraryRoundTrip(SearchInput);
    assertSchemaArbitraryRoundTrip(Binding);
    assertSchemaArbitraryRoundTrip(Scope);
    assertSchemaArbitraryRoundTrip(StatementResult);
    assertSchemaArbitraryRoundTrip(CoercionFunction);
    assertSchemaArbitraryRoundTrip(PromiseMethodReference);
    assertSchemaArbitraryRoundTrip(GlobalNamespace);
    assertSchemaArbitraryRoundTrip(GlobalMethodReference);
    assertSchemaArbitraryRoundTrip(JsonMethodReference);
    assertSchemaArbitraryRoundTrip(UriFunction);
    assertSchemaArbitraryRoundTrip(ErrorConstructorReference);
    assertSchemaArbitraryRoundTrip(Operation);
    assertSchemaArbitraryRoundTrip(ApiKeyCarrier);
    assertSchemaArbitraryRoundTrip(SecurityScheme);
    assertSchemaArbitraryRoundTrip(Credential);
    assertSchemaArbitraryRoundTrip(DiagnosticModel);
    assertSchemaArbitraryRoundTrip(ResultModel);
  });

  it("keeps identifier and path checks at the schema boundary", () => {
    assert.strictEqual(identifierSegment("$valid_1"), true);
    assert.strictEqual(identifierSegment("1invalid"), false);
    assert.strictEqual(Rs.isFailure(decodeUnknownIdentifierSegmentResult("with-dash")), true);
    assert.strictEqual(Rs.isFailure(decodeUnknownIdentifierSegmentResult("")), true);
    assert.strictEqual(Rs.isSuccess(decodeUnknownApiPathResult("/users/{id}")), true);
    assert.strictEqual(Rs.isFailure(decodeUnknownApiPathResult("users/{id}")), true);
    assert.strictEqual(Rs.isFailure(decodeUnknownOperationIdResult("   ")), true);
    assert.strictEqual(Rs.getOrThrow(decodeUnknownOperationIdResult("  getUser  ")), "getUser");
  });

  it("keeps string-domain checks equivalent to their defining laws", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(S.String)]),
          ([candidate]) => isIdentifierSegment(candidate) === /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(candidate),
      fcRuns(200)
        )
      )._tag
    ).toBe("Passed");
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(S.String)]),
          ([candidate]) => isApiPath2(candidate) === /^\/.*$/u.test(candidate),
      fcRuns(200)
        )
      )._tag
    ).toBe("Passed");
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(S.String)]),
          ([candidate]) => {
        const trimmed = Str.trim(candidate);
        const decoded = decodeUnknownOperationIdResult(candidate);

        return Str.isEmpty(trimmed) ? Rs.isFailure(decoded) : Rs.isSuccess(decoded) && decoded.success === trimmed;
          },
      fcRuns(200)
        )
      )._tag
    ).toBe("Passed");
  });

  it("decodes defaults once and keeps absent Option fields off the wire", () => {
    const limits = decodeExecutionLimitsSync({});
    const search = decodeSearchInputSync({});

    assert.strictEqual(O.isNone(limits.timeoutMs), true);
    assert.strictEqual(O.isNone(limits.maxToolCalls), true);
    assert.strictEqual(O.isNone(limits.maxOutputBytes), true);
    expect(encodeExecutionLimitsSync(limits)).toEqual({});

    assert.strictEqual(O.isNone(search.query), true);
    assert.strictEqual(O.isNone(search.namespace), true);
    assert.strictEqual(search.limit, 10);
    assert.strictEqual(search.offset, 0);
    expect(encodeSearchInputSync(search)).toEqual({ limit: 10, offset: 0 });
  });

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

  it("keeps numeric execution-limit checks equivalent to positive and non-negative integers", () => {
    const numeric = Arbitrary.schema(S.Finite);

    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([numeric]),
          ([value]) =>
            Rs.isSuccess(decodeUnknownExecutionLimitsResult({ timeoutMs: value })) ===
            (isInt(value) && N.isGreaterThan(0)(value)),
      fcRuns(200)
        )
      )._tag
    ).toBe("Passed");
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([numeric]),
          ([value]) =>
            Rs.isSuccess(decodeUnknownExecutionLimitsResult({ maxToolCalls: value })) ===
            (isInt(value) && N.isGreaterThanOrEqualTo(0)(value)),
      fcRuns(200)
        )
      )._tag
    ).toBe("Passed");
  });

  it("constructs and matches interpreter tagged unions through schema statics", () => {
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
    expect(encodeStatementBreakSync(statement)).toEqual({
      _tag: "Break",
      label: "outer",
    });
    expect(encodeStatementBreakSync(StatementBreak.new())).toEqual({
      _tag: "Break",
    });
  });

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

  it("encodes diagnostic defaults as a wire-compatible tagged object", () => {
    const diagnostic = DiagnosticModel.new("ParseError", "Unexpected token");

    expect(encodeDiagnosticModelSync(diagnostic)).toEqual({
      kind: "ParseError",
      message: "Unexpected token",
    });
    assert.strictEqual(diagnostic.message, "Unexpected token");
  });
});
