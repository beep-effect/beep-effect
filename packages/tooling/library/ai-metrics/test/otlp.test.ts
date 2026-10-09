import { AiMetricsOtlpAttributeKey, AiMetricsOtlpSpanProjection } from "@beep/repo-ai-metrics/otlp";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const encodeProjection = S.encodeUnknownEffect(AiMetricsOtlpSpanProjection);

it("allowlists the session-time stamp separately from ingest configuration", () => {
  expect(AiMetricsOtlpAttributeKey.literals).toContain("ai_metrics.session_harness_hash");
  expect(AiMetricsOtlpAttributeKey.literals).toContain("ai_metrics.config_snapshot_id");
});

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
