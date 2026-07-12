import { layerLocalLgtmServer, ServerObservabilityConfig, sanitizePrometheusMetrics } from "@beep/observability/server";
import { A } from "@beep/utils";
import { Layer } from "effect";
import { describe, expect, it } from "vitest";

describe("ServerUtilities", () => {
  it("builds the local LGTM layer when optional layer options are omitted", () => {
    const config = ServerObservabilityConfig.make({
      devtoolsEnabled: false,
      devtoolsUrl: "ws://localhost:34437",
      environment: "test",
      minLogLevel: "Info",
      otlpBaseUrl: "http://127.0.0.1:4318",
      otlpEnabled: false,
      otlpResourceAttributes: {},
      prometheusPrefix: "test",
      serviceName: "test-service",
      serviceVersion: "0.0.0",
    });

    expect(Layer.isLayer(layerLocalLgtmServer(config))).toBe(true);
  });

  it("removes duplicate Infinity histogram buckets from Prometheus output", () => {
    const input = A.join(['demo_bucket{le="10"} 1', 'demo_bucket{le="Infinity"} 1', 'demo_bucket{le="+Inf"} 1'], "\n");

    const sanitized = sanitizePrometheusMetrics(input);

    expect(sanitized).not.toContain('le="Infinity"');
    expect(sanitized).toContain('le="+Inf"');
  });
});
