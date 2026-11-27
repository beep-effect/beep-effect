import {
  makeRunpodOperations,
  RUNPOD_OPERATION_SPECS,
  RunpodError,
  RunpodProblem,
  RunpodProblemFromProblemDetails,
  RunpodRawErrorOptions,
} from "@beep/runpod";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as JsonPointer from "effect/JsonPointer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import type { RunpodOperationFactory, RunpodOperationSpec } from "@beep/runpod";

type AnySpec = RunpodOperationSpec<unknown, unknown>;

type WiredOperation = {
  readonly kind: "effect" | "eventStream" | "paginate";
  readonly spec: AnySpec;
  readonly items: O.Option<(page: never) => ReadonlyArray<unknown>>;
  readonly defaultRequest: O.Option<() => unknown>;
};

const DEFINITION_REF_PREFIX = "#/$defs/";
const problemEquivalence = S.toEquivalence(RunpodProblem);

const JsonSchemaObject = S.Struct({
  properties: S.Record(S.String, S.Struct({ type: S.Unknown.pipe(S.optionalKey) })).pipe(S.optionalKey),
  required: S.Array(S.String).pipe(S.optionalKey),
});

const recordOperations = (): ReadonlyArray<WiredOperation> => {
  const wired: Array<WiredOperation> = [];
  const factory: RunpodOperationFactory<never> = {
    effect: (spec: AnySpec, defaultRequest?: () => unknown) => {
      wired.push({ kind: "effect", spec, items: O.none(), defaultRequest: O.fromUndefinedOr(defaultRequest) });
      return () => Effect.die("recorded operation");
    },
    eventStream: (spec: AnySpec, defaultRequest?: () => unknown) => {
      wired.push({ kind: "eventStream", spec, items: O.none(), defaultRequest: O.fromUndefinedOr(defaultRequest) });
      return () => Stream.die("recorded operation");
    },
    paginate: (spec: AnySpec, items: (page: never) => ReadonlyArray<unknown>, defaultRequest?: () => unknown) => {
      wired.push({ kind: "paginate", spec, items: O.some(items), defaultRequest: O.fromUndefinedOr(defaultRequest) });
      return () => Stream.die("recorded operation");
    },
  };
  makeRunpodOperations(factory);
  return wired;
};

const operationMembers = (): ReadonlyArray<string> =>
  R.keys(
    makeRunpodOperations<never>({
      effect: () => () => Effect.die("unused"),
      eventStream: () => () => Stream.die("unused"),
      paginate: () => () => Stream.die("unused"),
    })
  );

const definitionOf = (schema: S.Constraint) => {
  const document = S.toJsonSchemaDocument(schema);
  return pipe(
    O.fromUndefinedOr(document.schema.$ref),
    O.filter(P.isString),
    O.filter(Str.startsWith(DEFINITION_REF_PREFIX)),
    O.map((ref) => JsonPointer.unescapeToken(Str.slice(Str.length(DEFINITION_REF_PREFIX))(ref))),
    O.flatMap((key) => R.get(document.definitions, key)),
    O.getOrElse((): unknown => document.schema),
    S.decodeUnknownEffect(JsonSchemaObject)
  );
};

const sorted = (values: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(values, Str.Order);

const allSpecs: ReadonlyArray<AnySpec> = R.values(RUNPOD_OPERATION_SPECS);

describe("@beep/runpod generated operations", () => {
  it.effect("wires every operation spec once under its method name, and every paginated list as a stream", () =>
    Effect.sync(() => {
      const wired = recordOperations();
      const direct = A.filter(wired, (operation) => operation.kind !== "paginate");
      const streams = A.filter(wired, (operation) => operation.kind === "paginate");
      const expectedMembers = [
        ...A.map(direct, ({ spec }) => spec.descriptor.methodName),
        ...A.map(streams, ({ spec }) => `${spec.descriptor.methodName}Stream`),
      ];

      expect(sorted(A.map(direct, ({ spec }) => spec.descriptor.operationId))).toEqual(
        sorted(A.map(allSpecs, ({ descriptor }) => descriptor.operationId))
      );
      expect(A.every(wired, ({ spec }) => A.some(allSpecs, (known) => known === spec))).toBe(true);
      expect(streams).toHaveLength(17);
      expect(sorted(operationMembers())).toEqual(sorted(expectedMembers));
    })
  );

  it.effect("offers a default request exactly when the request requires nothing, and each default is valid", () =>
    Effect.forEach(
      recordOperations(),
      Effect.fnUntraced(function* ({ spec, defaultRequest }) {
        const definition = yield* definitionOf(spec.request);
        const required = definition.required ?? A.empty<string>();

        deepStrictEqual(
          { operationId: spec.descriptor.operationId, hasDefault: O.isSome(defaultRequest) },
          { operationId: spec.descriptor.operationId, hasDefault: A.isReadonlyArrayEmpty(required) }
        );
        assertTrue(O.match(defaultRequest, { onNone: () => true, onSome: (make) => S.is(spec.request)(make()) }));
      }),
      { concurrency: 1, discard: true }
    )
  );

  it.effect("declares every descriptor parameter and body on the operation's request schema", () =>
    Effect.forEach(
      allSpecs,
      Effect.fnUntraced(function* ({ descriptor, request, responses }) {
        const definition = yield* definitionOf(request);
        const required = definition.required ?? A.empty<string>();
        const expected = [
          ...descriptor.pathParams,
          ...A.map(descriptor.queryParams, ({ field }) => field),
          ...A.map(descriptor.headerParams, ({ field }) => field),
          ...(descriptor.requestBody === "none" ? A.empty<string>() : ["body"]),
        ];
        const decodedStatuses = pipe(
          descriptor.responses,
          A.filter(({ body }) => body !== "event-stream"),
          A.map(({ status }) => status)
        );

        expect([descriptor.operationId, sorted(R.keys(definition.properties ?? {}))]).toEqual([
          descriptor.operationId,
          sorted(expected),
        ]);
        expect(A.every(descriptor.pathParams, (param) => A.contains(required, param))).toBe(true);
        expect(A.contains(required, "body")).toBe(descriptor.requestBodyRequired);
        deepStrictEqual(
          { operationId: descriptor.operationId, decoded: sorted(R.keys(responses)) },
          { operationId: descriptor.operationId, decoded: sorted(decodedStatuses) },
          "a decoder exists for exactly the declared statuses whose body is not an event stream (those are read as SSE)"
        );
      }),
      { concurrency: 1, discard: true }
    )
  );

  it.effect("reads each stream's items from an array field of its page schema", () =>
    Effect.forEach(
      A.filter(recordOperations(), ({ items }) => O.isSome(items)),
      Effect.fnUntraced(function* ({ spec, items }) {
        const read: Array<PropertyKey> = [];
        const page = new Proxy(
          {},
          {
            get: (_, key) => {
              read.push(key);
              return A.empty<unknown>();
            },
          }
        );
        const pageSchema = yield* Effect.fromOption(R.get(spec.responses, "200"));
        const fields = (yield* definitionOf(pageSchema)).properties ?? {};
        const extracted = O.map(items, (extract) => extract(page as never));

        assertSome(extracted, A.empty<unknown>());
        expect(read).toHaveLength(1);
        assertSome(
          pipe(
            A.head(read),
            O.flatMap((key) => R.get(fields, String(key))),
            O.map(({ type }) => type)
          ),
          "array"
        );
      }),
      { concurrency: 1, discard: true }
    )
  );
});

describe("@beep/runpod errors", () => {
  it.effect.prop(
    "re-encodes any decoded problem to problem details that decode back to it",
    [Arbitrary.schema(RunpodProblem)],
    ([problem]) =>
      Effect.gen(function* () {
        const details = yield* S.encodeEffect(RunpodProblemFromProblemDetails)(problem);
        const decoded = yield* S.decodeEffect(RunpodProblemFromProblemDetails)(details);

        assertTrue(
          problemEquivalence(decoded, problem),
          "Arbitrary builds null-prototype objects, so the round trip compares by schema equivalence"
        );
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect("round-trips a decoded problem back to RFC 9457 problem details", () =>
    Effect.gen(function* () {
      const details = {
        detail: "request body failed validation",
        errors: ["$: additional properties 'dataCenterId' not allowed"],
        status: 422,
        title: "Unprocessable Entity",
        type: "about:blank",
      };
      const problem = yield* S.decodeEffect(RunpodProblemFromProblemDetails)(details);
      const encoded = yield* S.encodeEffect(RunpodProblemFromProblemDetails)(problem);

      expect(encoded).toEqual(details);
    })
  );

  it.effect("builds config and raw errors with labelled causes", () =>
    Effect.sync(() => {
      const config = RunpodError.config("RUNPOD_API_KEY is missing");
      const raw = RunpodError.raw(
        RunpodRawErrorOptions.make({ method: "GET", path: "/v2/preview", reason: "response status", status: 503 })
      );

      expect(config.reason).toBe("config");
      assertSome(config.cause, "String");
      expect(raw.reason).toBe("response status");
      assertSome(raw.method, "GET");
      assertSome(raw.path, "/v2/preview");
      assertSome(raw.status, 503);
      assertNone(raw.cause);
    })
  );

  it.effect("treats a cause whose properties throw as having no label", () =>
    Effect.sync(() => {
      const hostile = new Proxy(
        {},
        {
          get: () => {
            throw new Error("hostile getter");
          },
          has: () => {
            throw new Error("hostile has");
          },
        }
      );

      assertNone(RunpodError.config(hostile).cause);
    })
  );
});
