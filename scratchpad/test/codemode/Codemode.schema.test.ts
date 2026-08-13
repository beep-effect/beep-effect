import { A, N, O, Str } from "@beep/utils";
import { fcRuns } from "@beep/test-utils";
import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, Result as Rs } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import {
  DiagnosticLocation,
  DiagnosticModel,
  ExecutionLimits,
  Result,
  ResultModel,
  execute,
  make,
} from "../../codemode/Codemode.service.ts";
import { IdentifierSegment, identifierSegment } from "../../codemode/Codemode.tool-schema.ts";
import { copyOut, CopyOutMode, SearchInput, ToolCallEnded } from "../../codemode/Codemode.tool-runtime.ts";
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
  PromiseMethodReference,
  PromiseMethodName,
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

const assertSchemaArbitraryRoundTrip = <Schema extends S.Codec<unknown>>(
  schema: Schema,
  numRuns = 40
): void => {
  const derived = S.toArbitrary(schema)(fc);
  const encode = S.encodeUnknownResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(derived, (value) =>
      equivalent(
        Rs.getOrThrow(decode(Rs.getOrThrow(encode(value)))),
        value
      )
    ),
    fcRuns(numRuns)
  );
};

describe("CodeMode schema laws", () => {
  it("rejects sparse arrays whose declared length exceeds the result boundary", () => {
    const sparse = new Array(100_001);

    expect(() => copyOut(sparse, CopyOutMode.Enum.json)).toThrow(/100000-item boundary limit/u);
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
    const decodeIdentifier = S.decodeUnknownResult(IdentifierSegment);
    const decodePath = S.decodeUnknownResult(ApiPath);
    const decodeOperationId = S.decodeUnknownResult(OperationId);

    assert.strictEqual(identifierSegment("$valid_1"), true);
    assert.strictEqual(identifierSegment("1invalid"), false);
    assert.strictEqual(Rs.isFailure(decodeIdentifier("with-dash")), true);
    assert.strictEqual(Rs.isFailure(decodeIdentifier("")), true);
    assert.strictEqual(Rs.isSuccess(decodePath("/users/{id}")), true);
    assert.strictEqual(Rs.isFailure(decodePath("users/{id}")), true);
    assert.strictEqual(Rs.isFailure(decodeOperationId("   ")), true);
    assert.strictEqual(Rs.getOrThrow(decodeOperationId("  getUser  ")), "getUser");
  });

  it("keeps string-domain checks equivalent to their defining laws", () => {
    const isIdentifier = S.is(IdentifierSegment);
    const isApiPath = S.is(ApiPath);
    const decodeOperationId = S.decodeUnknownResult(OperationId);

    fc.assert(
      fc.property(fc.string(), (candidate) =>
        isIdentifier(candidate) === /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(candidate)
      ),
      fcRuns(200)
    );
    fc.assert(
      fc.property(fc.string(), (candidate) =>
        isApiPath(candidate) === /^\/.*$/u.test(candidate)
      ),
      fcRuns(200)
    );
    fc.assert(
      fc.property(fc.string(), (candidate) => {
        const trimmed = Str.trim(candidate);
        const decoded = decodeOperationId(candidate);

        return Str.isEmpty(trimmed)
          ? Rs.isFailure(decoded)
          : Rs.isSuccess(decoded) && decoded.success === trimmed;
      }),
      fcRuns(200)
    );
  });

  it("decodes defaults once and keeps absent Option fields off the wire", () => {
    const limits = S.decodeSync(ExecutionLimits)({});
    const search = S.decodeSync(SearchInput)({});

    assert.strictEqual(O.isNone(limits.timeoutMs), true);
    assert.strictEqual(O.isNone(limits.maxToolCalls), true);
    assert.strictEqual(O.isNone(limits.maxOutputBytes), true);
    expect(S.encodeSync(ExecutionLimits)(limits)).toEqual({});

    assert.strictEqual(O.isNone(search.query), true);
    assert.strictEqual(O.isNone(search.namespace), true);
    assert.strictEqual(search.limit, 10);
    assert.strictEqual(search.offset, 0);
    expect(S.encodeSync(SearchInput)(search)).toEqual({ limit: 10, offset: 0 });
  });

  it("rejects unsafe execution limits through schema checks", () => {
    const decode = S.decodeUnknownResult(ExecutionLimits);

    assert.strictEqual(Rs.isFailure(decode({ timeoutMs: 0 })), true);
    assert.strictEqual(Rs.isFailure(decode({ timeoutMs: 1.5 })), true);
    assert.strictEqual(Rs.isFailure(decode({ maxToolCalls: -1 })), true);
    assert.strictEqual(Rs.isFailure(decode({ maxOutputBytes: Number.NaN })), true);
  });

  it("enforces one-based diagnostics and exhaustive reference pairs", () => {
    const decodeLocation = S.decodeUnknownResult(DiagnosticLocation);
    const decodeIntrinsic = S.decodeUnknownResult(IntrinsicReference);
    const decodeGlobal = S.decodeUnknownResult(GlobalMethodReference);

    assert.strictEqual(Rs.isFailure(decodeLocation({ line: 0, column: 1 })), true);
    assert.strictEqual(Rs.isFailure(decodeLocation({ line: 1, column: 0 })), true);
    assert.strictEqual(Rs.isSuccess(decodeLocation({ line: 1, column: 1 })), true);
    assert.strictEqual(
      Rs.isFailure(
        decodeIntrinsic({
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
        decodeGlobal({
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
      assert.strictEqual(S.is(Result)(success), true);
      assert.strictEqual(S.is(Result)(failure), true);
    })
  );

  it("rejects invalid terminal tool observations", () => {
    const decodeEnded = S.decodeUnknownResult(ToolCallEnded);
    assert.strictEqual(
      Rs.isFailure(
        decodeEnded({
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
        decodeEnded({
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
        decodeEnded({
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
    const decode = S.decodeUnknownResult(ExecutionLimits);
    const numeric = fc.double({ noDefaultInfinity: false, noNaN: false });

    fc.assert(
      fc.property(numeric, (value) =>
        Rs.isSuccess(decode({ timeoutMs: value })) ===
          (S.is(S.Int)(value) && N.isGreaterThan(0)(value))
      ),
      fcRuns(200)
    );
    fc.assert(
      fc.property(numeric, (value) =>
        Rs.isSuccess(decode({ maxToolCalls: value })) ===
          (S.is(S.Int)(value) && N.isGreaterThanOrEqualTo(0)(value))
      ),
      fcRuns(200)
    );
  });

  it("constructs and matches interpreter tagged unions through schema statics", () => {
    const coercion = CoercionFunction.new("parseInt");
    const promiseMethod = PromiseMethodReference.new("allSettled");
    const globalNamespace = GlobalNamespace.new("JSON");
    const globalMethod = GlobalMethodReference.new(
      GlobalMethod.cases.String.make({ name: "fromCodePoint" })
    );
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
    assert.strictEqual(S.is(MemberReference)(member), true);
    assert.strictEqual(member.target, target);
    assert.strictEqual(StatementResult.guards.Break(statement), true);
    expect(S.encodeSync(StatementBreak)(statement)).toEqual({
      _tag: "Break",
      label: "outer",
    });
    expect(S.encodeSync(StatementBreak)(StatementBreak.new())).toEqual({
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
    assert.strictEqual(
      ApiKeyCarrier.isAnyOf(A.make("query", "cookie"))(ApiKeyHeader.new("X-API-Key")),
      false
    );
  });

  it("encodes diagnostic defaults as a wire-compatible tagged object", () => {
    const diagnostic = DiagnosticModel.new("ParseError", "Unexpected token");

    expect(S.encodeSync(DiagnosticModel)(diagnostic)).toEqual({
      kind: "ParseError",
      message: "Unexpected token",
    });
    assert.strictEqual(diagnostic.message, "Unexpected token");
  });
});
