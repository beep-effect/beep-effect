import { layerJson, layerProtobuf, OtlpPacketLab } from "@beep/observability/experimental/server";
import { Effect, Layer } from "effect";
import { OtlpSerialization } from "effect/observability/OtlpSerialization";
import { describe, expect, it } from "vitest";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("OtlpPacketLab", () => {
  it("captures JSON OTLP packets", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const packets = yield* Effect.gen(function* () {
          const lab = yield* OtlpPacketLab;
          const serialization = yield* OtlpSerialization;

          serialization.logs({ resourceLogs: [] });

          return yield* lab.snapshot;
        }).pipe(provideScopedLayer(layerJson));

        expect(packets[0]?.kind).toBe("logs");
        expect(packets[0]?.encoding).toBe("json");
        expect(packets[0]?.contentType).toContain("application/json");
      })
    ));

  it("captures protobuf OTLP packets", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const packets = yield* Effect.gen(function* () {
          const lab = yield* OtlpPacketLab;
          const serialization = yield* OtlpSerialization;

          serialization.traces({ resourceSpans: [] });

          return yield* lab.snapshot;
        }).pipe(provideScopedLayer(layerProtobuf));

        expect(packets[0]?.kind).toBe("traces");
        expect(packets[0]?.encoding).toBe("protobuf");
        expect(packets[0]?.preview).toContain("Uint8Array");
      })
    ));
});
