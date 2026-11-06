import { fcRuns } from "@beep/fc-runs";
import {
  encodeManagedControllerObservation,
  ManagedControllerError,
  ManagedControllerObservation,
} from "@beep/repo-ai-metrics/managed-controller";
import { encodeNativeTraceBatch, NativeExportInput } from "@beep/repo-ai-metrics/native-export";
import {
  NativeTraceBatch,
  NativeTraceError,
  NativeTraceMetadata,
  NativeTraceRequest,
  projectNativeTraceRequest,
} from "@beep/repo-ai-metrics/native-trace";
import { hashPrivateIdentifier, hashPublicTextSha256 } from "@beep/repo-ai-metrics/privacy";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect, vi } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Protobuf from "protobufjs";

// Independent OTLP v1.9.0 fixture codec: tests do not import a private production encoder.
const wire = Protobuf.parse(`syntax="proto3";
message Value { oneof value { string string_value=1; bool bool_value=2; int64 int_value=3; } }
message Attribute { string key=1; Value value=2; }
message Resource { repeated Attribute attributes=1; }
message Status { int32 code=3; }
message Span { bytes trace_id=1; bytes span_id=2; bytes parent_span_id=4; string name=5; int32 kind=6; fixed64 start_time_unix_nano=7; fixed64 end_time_unix_nano=8; repeated Attribute attributes=9; Status status=15; }
message ScopeSpans { repeated Span spans=2; }
message ResourceSpans { Resource resource=1; repeated ScopeSpans scope_spans=2; }
message Request { repeated ResourceSpans resource_spans=1; }`).root.lookupType("Request");

const id = (c: string) => Sha256Hex.make(Str.repeat(64)(c));
const salt = "synthetic-managed-controller-salt";
const observation = ManagedControllerObservation.make({
  launchId: id("a"),
  launchRouteId: id("b"),
  processInstanceId: id("b"),
  sourceSessionId: id("c"),
  evidenceId: id("d"),
  startTimeUnixNano: "1793000000000000000",
  endTimeUnixNano: "1793000000100000000",
  elapsedNanos: "100000000",
});
const request = (body: Uint8Array, managed = true) =>
  NativeTraceRequest.make({
    routeId: id("e"),
    hashSalt: Redacted.make(salt),
    contentType: "application/x-protobuf",
    body,
    producer: managed ? O.some("managed-controller") : O.none(),
    usageConvention: "unknown",
    approvedModels: [],
  });
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));
const encodeBatch = S.encodeEffect(S.fromJsonString(NativeTraceBatch));
const decoded = S.Struct({
  resourceSpans: S.Array(
    S.Struct({
      scopeSpans: S.Array(
        S.Struct({
          spans: S.Array(
            S.Struct({
              traceId: S.Uint8Array,
              spanId: S.Uint8Array,
              name: S.String,
              startTimeUnixNano: S.String,
              endTimeUnixNano: S.String,
              status: S.Struct({ code: S.Int }),
              attributes: S.Array(S.Struct({ key: S.String, value: S.Unknown })),
            })
          ),
        })
      ),
    })
  ),
});
const read = (bytes: Uint8Array) =>
  S.decodeUnknownEffect(decoded)(wire.toObject(wire.decode(bytes), { longs: String }));

it.layer(NodeCrypto.layer)((it) => {
  it.effect.prop(
    "preserves arbitrary admitted launch and prehashed session identities through controller transport",
    [Arbitrary.schema(Sha256Hex), Arbitrary.schema(Sha256Hex)],
    Effect.fnUntraced(function* ([launchId, sourceSessionId]) {
      const sample = ManagedControllerObservation.make({ ...observation, launchId, sourceSessionId });
      const body = yield* encodeManagedControllerObservation(sample);
      const batch = yield* projectNativeTraceRequest(request(body));
      expect(batch.rejections).toEqual([]);
      expect(batch.spans).toHaveLength(1);
      const span = yield* Effect.fromOption(A.head(batch.spans));
      assertSome(span.sessionHash, sourceSessionId);
      assertSome(span.managedController, sample);
    }),
    { arbitrary: fcRuns(25) }
  );
  it.effect(
    "preserves prehashed session correlation and explicit controller origin without model or token claims",
    () =>
      Effect.gen(function* () {
        const body = yield* encodeManagedControllerObservation(observation);
        const batch = yield* projectNativeTraceRequest(request(body));
        expect(batch.rejections).toEqual([]);
        const span = O.getOrThrow(A.head(batch.spans));
        expect(span.kind).toBe("AGENT");
        assertSome(span.sessionHash, observation.sourceSessionId);
        const doubleHashedSession = yield* hashPrivateIdentifier(observation.sourceSessionId, O.some(salt));
        assertFalse(O.contains(span.sessionHash, doubleHashedSession));
        assertSome(span.managedController, observation);
        deepStrictEqual(span.usage, {
          convention: "unknown",
          input: O.none(),
          output: O.none(),
          cacheRead: O.none(),
          cacheWrite: O.none(),
        });
        const exported = yield* encodeNativeTraceBatch(
          NativeExportInput.make({
            project: "synthetic",
            hostId: id("f"),
            namespaceId: batch.namespaceId,
            acceptedAtMillis: 1793000000000,
            spans: batch.spans,
          })
        );
        const keys = A.map(
          O.getOrThrow(
            A.head(
              O.getOrThrow(A.head(O.getOrThrow(A.head((yield* read(exported.body)).resourceSpans)).scopeSpans)).spans
            )
          ).attributes,
          (a) => a.key
        );
        expect(keys).toContain("ai_metrics.producer_origin");
        expect(keys).toContain("ai_metrics.launch_id");
        expect(keys).toContain("ai_metrics.controller_elapsed_nanos");
        expect(A.some(keys, Str.startsWith("llm."))).toBe(false);
        const serialized = yield* encodeBatch(batch);
        for (const bodyKey of ["input.value", "output.value", "tool.parameters", salt])
          expect(serialized).not.toContain(bodyKey);
      })
  );

  it.effect("keeps legacy native event/request IDs, canonical bytes and export digest exact to pre-change source", () =>
    Effect.gen(function* () {
      const body = yield* encodeJsonValue({
        resourceSpans: [
          {
            scopeSpans: [
              {
                spans: [
                  {
                    traceId: Str.repeat(32)("1"),
                    spanId: Str.repeat(16)("2"),
                    name: "legacy-canary",
                    startTimeUnixNano: "1793000000000000000",
                    endTimeUnixNano: "1793000000100000000",
                    attributes: [
                      { key: "session.id", value: { stringValue: "legacy-session" } },
                      { key: "openinference.span.kind", value: { stringValue: "AGENT" } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      const batch = yield* projectNativeTraceRequest(
        NativeTraceRequest.make({
          ...request(new Uint8Array(), false),
          contentType: "application/json",
          body: new TextEncoder().encode(body),
        })
      );
      expect(batch.spans[0]?.eventId).toBe("187d56666add5c37ca70e7a31afed8dd622fe4531b8b74cdc89c2eb60765d0a7");
      expect(batch.requestId).toBe("cb3b993a865b8abd51649ecd00509d1c1a704af22d32d6a31cd37b01c66d88dd");
      const batchJson = yield* encodeBatch(batch);
      const batchHash = yield* hashPublicTextSha256(batchJson);
      expect(batchHash).toBe("08286b60b3777f70070d8412ca7e5b258f126c4780fe21da8efc0fdedc4201a4");
      const encoded = yield* encodeNativeTraceBatch(
        NativeExportInput.make({
          project: "legacy-golden",
          hostId: id("f"),
          namespaceId: batch.namespaceId,
          acceptedAtMillis: 1793000000000,
          spans: batch.spans,
        })
      );
      expect(encoded.payloadDigest).toBe("c9ac2128edb785ee67cf519650bb891332ce433f4dce06f0dba0134784e1950a");
    })
  );

  it.effect("body attributes cannot promote a native route and controller identity is domain separated", () =>
    Effect.gen(function* () {
      const body = yield* encodeManagedControllerObservation(observation);
      const native = yield* projectNativeTraceRequest(request(body, false));
      const managed = yield* projectNativeTraceRequest(request(body));
      const legacy = O.getOrThrow(A.head(native.spans));
      assertNone(legacy.managedController);
      assertNone(legacy.sessionHash);
      const legacyEventId = yield* hashPrivateIdentifier(
        `native-span/v1:${id("e")}:${legacy.traceId}:${legacy.spanId}`,
        O.some(salt)
      );
      expect(legacy.eventId).toBe(legacyEventId);
      expect(legacy.eventId).not.toBe(managed.spans[0]?.eventId);
      const encoded = yield* encodeBatch(native);
      expect(encoded).not.toContain("managedController");
    })
  );

  it.effect("rejects missing controller bindings, fixture policy and native token/model fields", () =>
    Effect.gen(function* () {
      const body = yield* encodeManagedControllerObservation(observation);
      for (const attribute of [
        { key: "session.id", value: { stringValue: "private-native-session" } },
        { key: "llm.model_name", value: { stringValue: "private-model" } },
        { key: "input_tokens", value: { intValue: "3" } },
        { key: "llm.provider", value: { stringValue: "invented-provider" } },
        { key: "openinference.span.kind", value: { stringValue: "LLM" } },
      ]) {
        const raw = wire.toObject(wire.decode(body), { longs: String });
        const value = yield* S.decodeUnknownEffect(decoded)(raw);
        const original = O.getOrThrow(
          A.head(O.getOrThrow(A.head(O.getOrThrow(A.head(value.resourceSpans)).scopeSpans)).spans)
        );
        // Mutation is confined to a synthetic decoded transport, never a real source body.
        const changed = wire
          .encode({
            resourceSpans: [
              { scopeSpans: [{ spans: [{ ...original, attributes: [...original.attributes, attribute] }] }] },
            ],
          })
          .finish();
        const batch = yield* projectNativeTraceRequest(request(changed));
        expect(batch.spans).toHaveLength(0);
        expect(batch.rejections).toHaveLength(1);
      }
      const fixture = yield* projectNativeTraceRequest(
        NativeTraceRequest.make({ ...request(body), syntheticFixtureMetadata: O.some(true) })
      );
      expect(fixture.spans).toEqual([]);
      const oversizedInterval = yield* S.decodeEffect(ManagedControllerObservation)({
        ...observation,
        elapsedNanos: "120000000001",
      }).pipe(Effect.isFailure);
      expect(oversizedInterval).toBe(true);
      const reversedInterval = yield* S.decodeEffect(ManagedControllerObservation)({
        ...observation,
        endTimeUnixNano: "1",
      }).pipe(Effect.isFailure);
      expect(reversedInterval).toBe(true);
    })
  );
  it.effect("refuses absent and malformed managed provenance without retaining private values", () =>
    Effect.gen(function* () {
      const body = yield* encodeManagedControllerObservation(observation);
      const value = yield* read(body);
      const original = O.getOrThrow(
        A.head(O.getOrThrow(A.head(O.getOrThrow(A.head(value.resourceSpans)).scopeSpans)).spans)
      );
      for (const key of [
        "beep.managed.launch_id",
        "beep.managed.launch_route_id",
        "beep.managed.process_instance_id",
        "beep.managed.session_hash",
        "beep.managed.evidence_id",
        "beep.managed.elapsed_nanos",
      ]) {
        for (const malformed of [false, true]) {
          const attributes = A.filter(original.attributes, (attribute) => attribute.key !== key);
          const changed = wire
            .encode({
              resourceSpans: [
                {
                  scopeSpans: [
                    {
                      spans: [
                        {
                          ...original,
                          attributes: malformed
                            ? [...attributes, { key, value: { stringValue: "PRIVATE_INVALID_BINDING" } }]
                            : attributes,
                        },
                      ],
                    },
                  ],
                },
              ],
            })
            .finish();
          const batch = yield* projectNativeTraceRequest(request(changed));
          expect(batch.spans).toEqual([]);
          expect(batch.rejections).toEqual([{ ordinal: 0, reason: "invalid-span" }]);
          const rejectedBatch = yield* encodeBatch(batch);
          expect(rejectedBatch).not.toContain("PRIVATE_INVALID_BINDING");
        }
      }
    })
  );

  it.effect("refuses controller identity substitution, parent attachment and incomplete measured intervals", () =>
    Effect.gen(function* () {
      const body = yield* encodeManagedControllerObservation(observation);
      const value = yield* read(body);
      const original = O.getOrThrow(
        A.head(O.getOrThrow(A.head(O.getOrThrow(A.head(value.resourceSpans)).scopeSpans)).spans)
      );
      for (const changedSpan of [
        { ...original, traceId: new Uint8Array(16).fill(1) },
        { ...original, spanId: new Uint8Array(8).fill(1) },
        { ...original, parentSpanId: new Uint8Array(8).fill(1) },
        { ...original, startTimeUnixNano: "0" },
        { ...original, endTimeUnixNano: "0" },
        { ...original, status: { code: 2 } },
      ]) {
        const changed = wire.encode({ resourceSpans: [{ scopeSpans: [{ spans: [changedSpan] }] }] }).finish();
        const batch = yield* projectNativeTraceRequest(request(changed));
        expect(batch.spans).toEqual([]);
        expect(batch.rejections).toEqual([{ ordinal: 0, reason: "invalid-span" }]);
      }
      const convention = yield* projectNativeTraceRequest(
        NativeTraceRequest.make({ ...request(body), usageConvention: "openinference" })
      );
      expect(convention.spans).toEqual([]);
      expect(convention.rejections).toHaveLength(1);
    })
  );

  it.effect("metadata codec refuses inconsistent controller claims while native metadata stays valid", () =>
    Effect.gen(function* () {
      const body = yield* encodeManagedControllerObservation(observation);
      const batch = yield* projectNativeTraceRequest(request(body));
      const valid = O.getOrThrow(A.head(batch.spans));
      expect(S.is(NativeTraceMetadata)(valid)).toBe(true);
      for (const invalid of [
        { ...valid, kind: "LLM" },
        { ...valid, status: "error" },
        { ...valid, sessionHash: O.none() },
        { ...valid, startTimeUnixNano: O.none() },
        { ...valid, endTimeUnixNano: O.none() },
        { ...valid, modelName: O.some("private-model") },
        { ...valid, modelHash: O.some(id("a")) },
        { ...valid, usage: { ...valid.usage, input: O.some(1) } },
        { ...valid, usage: { ...valid.usage, convention: "openinference" } },
      ])
        expect(S.is(NativeTraceMetadata)(invalid)).toBe(false);
      expect(S.is(NativeTraceMetadata)({ ...valid, managedController: O.none() })).toBe(true);
      expect(NativeTraceError.make({ reason: "invalid-envelope" }).message).toBe(
        "Native trace request refused (invalid-envelope)."
      );
    })
  );
});

it.layer(NodeCrypto.layer, { timeout: "30 seconds" })((it) => {
  it.effect("refuses invalid controller evidence before encoding or hashing it", () =>
    Effect.gen(function* () {
      const invalid = ManagedControllerObservation.make(
        { ...observation, elapsedNanos: "120000000001" },
        { disableChecks: true }
      );
      const error = yield* Effect.flip(encodeManagedControllerObservation(invalid));
      expect(error).toEqual(ManagedControllerError.make({ reason: "evidence" }));
    })
  );

  it.effect("retries the whole request when only the controller identity hash fails", () =>
    Effect.gen(function* () {
      const body = yield* encodeManagedControllerObservation(observation);
      const subtle = globalThis.crypto.subtle;
      const digest = subtle.digest.bind(subtle);
      const isIdentityInput = (data: Parameters<SubtleCrypto["digest"]>[1]) => {
        const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer);
        return Str.startsWith("managed-controller-trace/v1:")(new TextDecoder().decode(bytes));
      };
      const spy = yield* Effect.acquireRelease(
        Effect.sync(() =>
          vi.spyOn(subtle, "digest").mockImplementation((algorithm, data) => {
            if (isIdentityInput(data)) throw new Error("PRIVATE_DIGEST_FAILURE");
            return digest(algorithm, data);
          })
        ),
        (mock) => Effect.sync(() => mock.mockRestore())
      );
      const error = yield* Effect.flip(projectNativeTraceRequest(request(body)));
      expect(error).toEqual(NativeTraceError.make({ reason: "hash-failure" }));
      expect(spy).toHaveBeenCalled();
    })
  );

  it.effect("returns a content-free encoding error when the protobuf writer fails", () =>
    Effect.gen(function* () {
      const writer = yield* Effect.acquireRelease(
        Effect.sync(() =>
          vi.spyOn(Protobuf.Writer.prototype, "finish").mockImplementationOnce(() => {
            throw ManagedControllerError.make({ reason: "evidence" });
          })
        ),
        (mock) => Effect.sync(() => mock.mockRestore())
      );
      const error = yield* Effect.flip(encodeManagedControllerObservation(observation));
      expect(error).toEqual(ManagedControllerError.make({ reason: "encoding" }));
      expect(writer).toHaveBeenCalledTimes(1);
    })
  );
});

for (const domain of ["managed-controller-trace/v1:", "managed-controller-canary/v1:"]) {
  it.layer(NodeCrypto.layer)((it) =>
    it.effect("fails the whole mixed controller batch when identity crypto fails", () =>
      Effect.gen(function* () {
        const other = ManagedControllerObservation.make({ ...observation, launchId: id("6") });
        const first = yield* encodeManagedControllerObservation(observation);
        const second = yield* encodeManagedControllerObservation(other);
        // Protobuf concatenation merges repeated resourceSpans into one two-span request.
        const mixed = new Uint8Array([...first, ...second]);
        const healthy = yield* projectNativeTraceRequest(request(mixed));
        expect(healthy.spans).toHaveLength(2);
        const digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
        let failedCalls = 0;
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            vi.spyOn(globalThis.crypto.subtle, "digest").mockImplementation((algorithm, data) => {
              if (new TextDecoder().decode(data) === `${domain}${other.launchId}`) {
                failedCalls += 1;
                return Promise.reject(new Error("PRIVATE_CRYPTO_FAILURE"));
              }
              return digest(algorithm, data);
            })
          ),
          (mock) => Effect.sync(() => mock.mockRestore())
        );
        const error = yield* Effect.flip(projectNativeTraceRequest(request(mixed)));
        expect(error).toEqual(NativeTraceError.make({ reason: "hash-failure" }));
        expect(failedCalls).toBe(1);
        expect(String(error)).not.toContain("PRIVATE_CRYPTO_FAILURE");
      })
    )
  );
}
