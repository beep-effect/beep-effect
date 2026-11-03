import {
  encodeManagedControllerObservation,
  ManagedControllerObservation,
} from "@beep/repo-ai-metrics/managed-controller";
import { encodeNativeTraceBatch, NativeExportInput } from "@beep/repo-ai-metrics/native-export";
import { NativeTraceBatch, NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { hashPrivateIdentifier, hashPublicTextSha256 } from "@beep/repo-ai-metrics/privacy";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { nativeTraceWire as wire } from "../src/internal/native-trace-wire.ts";

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
        assertFalse(
          O.contains(span.sessionHash, yield* hashPrivateIdentifier(observation.sourceSessionId, O.some(salt)))
        );
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
      expect(yield* hashPublicTextSha256(yield* encodeBatch(batch))).toBe(
        "08286b60b3777f70070d8412ca7e5b258f126c4780fe21da8efc0fdedc4201a4"
      );
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
      expect(legacy.eventId).toBe(
        yield* hashPrivateIdentifier(`native-span/v1:${id("e")}:${legacy.traceId}:${legacy.spanId}`, O.some(salt))
      );
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
      expect(
        yield* S.decodeEffect(ManagedControllerObservation)({
          ...observation,
          elapsedNanos: "120000000001",
        }).pipe(Effect.isFailure)
      ).toBe(true);
      expect(
        yield* S.decodeEffect(ManagedControllerObservation)({ ...observation, endTimeUnixNano: "1" }).pipe(
          Effect.isFailure
        )
      ).toBe(true);
    })
  );
});
