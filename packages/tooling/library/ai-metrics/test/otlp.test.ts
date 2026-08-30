import { AiMetricsOtlpSpanProjection } from "@beep/repo-ai-metrics/otlp";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const encodeProjection = S.encodeUnknownEffect(AiMetricsOtlpSpanProjection);

describe("@beep/repo-ai-metrics OTLP projection invariants", () => {
  it.effect("carries watermark identity independently of the exported attribute payload", () =>
    Effect.gen(function* () {
      const attributes = {
        "ai_metrics.event_name": "codex.event_msg",
        "openinference.span.kind": "CHAIN",
      };
      const projection = AiMetricsOtlpSpanProjection.make({
        attributes,
        parentSpanId: O.some("1122334455667788"),
        spanId: "8877665544332211",
        spanName: "ai_metrics.agent.turn",
        traceId: "0123456789abcdef0123456789abcdef",
        turnId: O.some("turn-1"),
      });

      expect(AiMetricsOtlpSpanProjection.turnIdsFor([projection])).toEqual(["turn-1"]);
      expect(projection.attributes).toEqual(attributes);
      expect(projection.attributes).not.toHaveProperty("ai_metrics.turn_id");
      expect(yield* encodeProjection(projection)).toEqual({
        attributes,
        parentSpanId: "1122334455667788",
        spanId: "8877665544332211",
        spanName: "ai_metrics.agent.turn",
        traceId: "0123456789abcdef0123456789abcdef",
        turnId: "turn-1",
      });
    })
  );

  it.effect("keeps optional projection keys absent for session spans", () =>
    Effect.gen(function* () {
      const projection = AiMetricsOtlpSpanProjection.make({
        attributes: { "openinference.span.kind": "AGENT" },
        spanId: "1122334455667788",
        spanName: "ai_metrics.agent.session",
        traceId: "0123456789abcdef0123456789abcdef",
      });
      const encoded = yield* encodeProjection(projection);

      expect(AiMetricsOtlpSpanProjection.turnIdsFor([projection])).toEqual([]);
      expect(encoded).not.toHaveProperty("parentSpanId");
      expect(encoded).not.toHaveProperty("turnId");
    })
  );
});
