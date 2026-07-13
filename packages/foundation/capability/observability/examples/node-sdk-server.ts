import { PrettyLoggerConfig, renderLogBanner } from "@beep/observability";
import { layerNodeSdkServer, ServerObservabilityConfig } from "@beep/observability/server";

const config = ServerObservabilityConfig.make({
  serviceName: "beep-sidecar",
  serviceVersion: "0.0.0",
  environment: "local",
  minLogLevel: "Info",
  otlpBaseUrl: "http://localhost:4318",
  otlpEnabled: true,
  otlpResourceAttributes: {
    beep_slice: "examples",
  },
  devtoolsEnabled: false,
  devtoolsUrl: "ws://localhost:34437",
  prometheusPrefix: "beep",
});

void renderLogBanner("Node SDK Server", {
  pretty: PrettyLoggerConfig.make({
    theme: "ocean",
    bannerMode: "startup",
  }),
});
void layerNodeSdkServer(config);
