import { layerJson, layerProtobuf, OtlpPacketLab } from "@beep/observability/experimental/server";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { OtlpSerialization } from "effect/observability/OtlpSerialization";

describe("OtlpPacketLab", () => {
  it.layer(layerJson, { timeout: "10 seconds" })((it) => {
    it.effect("captures JSON OTLP packets", () =>
      Effect.gen(function* () {
        const lab = yield* OtlpPacketLab;
        const serialization = yield* OtlpSerialization;

        serialization.logs({ resourceLogs: [] });

        const packets = yield* lab.snapshot;

        expect(packets).toHaveLength(1);

        expect(packets[0]?.kind).toBe("logs");
        expect(packets[0]?.encoding).toBe("json");
        expect(packets[0]?.contentType).toContain("application/json");
      })
    );
  });

  it.layer(layerProtobuf, { timeout: "10 seconds" })((it) => {
    it.effect("captures protobuf OTLP packets", () =>
      Effect.gen(function* () {
        const lab = yield* OtlpPacketLab;
        const serialization = yield* OtlpSerialization;

        serialization.traces({ resourceSpans: [] });

        const packets = yield* lab.snapshot;

        expect(packets).toHaveLength(1);

        expect(packets[0]?.kind).toBe("traces");
        expect(packets[0]?.encoding).toBe("protobuf");
        expect(packets[0]?.preview).toContain("Uint8Array");
      })
    );
  });
});
