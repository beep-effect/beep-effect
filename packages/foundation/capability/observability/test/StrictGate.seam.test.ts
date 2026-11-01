/**
 * Pins the seam the strict gate depends on: `Otlp.layer` takes its serializer
 * and its HTTP client from context, so the gate and the never-sending egress
 * client can replace both. If an Effect bump closes over either one, this
 * file stops typechecking.
 */
import { it } from "@beep/test-runner";
import { describe, expectTypeOf } from "@effect/vitest";
import * as Effect from "effect/Effect";
import type { layerStrictOtlp, StrictEgressSink, StrictGate, StrictSalt } from "@beep/observability/strict";
import type * as HttpClient from "effect/http/HttpClient";
import type * as Layer from "effect/Layer";
import type * as Otlp from "effect/observability/Otlp";
import type * as OtlpExporter from "effect/observability/OtlpExporter";
import type * as OtlpSerialization from "effect/observability/OtlpSerialization";

describe("strict gate seam", () => {
  it.effect("Otlp.layer requires exactly an HttpClient and an OtlpSerialization", () =>
    Effect.sync(() => {
      expectTypeOf<Layer.Services<ReturnType<typeof Otlp.layer>>>().toEqualTypeOf<
        HttpClient.HttpClient | OtlpSerialization.OtlpSerialization
      >();
      expectTypeOf<Layer.Success<ReturnType<typeof Otlp.layer>>>().toEqualTypeOf<OtlpExporter.Flusher>();
    })
  );

  it.effect("layerStrictOtlp leaves only the salt and the sink to its caller", () =>
    Effect.sync(() => {
      expectTypeOf<Layer.Services<ReturnType<typeof layerStrictOtlp>>>().toEqualTypeOf<StrictSalt | StrictEgressSink>();
      expectTypeOf<Layer.Success<ReturnType<typeof layerStrictOtlp>>>().toEqualTypeOf<
        StrictGate | OtlpExporter.Flusher
      >();
    })
  );
});
