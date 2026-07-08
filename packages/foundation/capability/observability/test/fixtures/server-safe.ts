import { LoggingConfig, observeWorkflow, PrettyLoggerConfig, renderLogBanner } from "@beep/observability";
import {
  HttpApiTelemetryDescriptor,
  httpApiSuccessStatus,
  injectTraceContextHeaders,
  layerLocalLgtmServer,
  layerNodeSdkServer,
  makeHttpApiMetrics,
  observeHttpApiHandler,
  ServerObservabilityConfig,
} from "@beep/observability/server";
import { Cause, Effect, Metric } from "effect";
import * as S from "effect/Schema";
import { HttpApiSchema } from "effect/unstable/httpapi";

const loggingConfig = LoggingConfig.make({
  format: "json",
  minLogLevel: "Info",
});

const serverConfig = ServerObservabilityConfig.make({
  serviceName: "beep-server",
  serviceVersion: "0.0.0",
  environment: "test",
  minLogLevel: "Info",
  otlpBaseUrl: "http://localhost:4318",
  otlpEnabled: true,
  otlpResourceAttributes: {},
  devtoolsEnabled: false,
  devtoolsUrl: "ws://localhost:34437",
  prometheusPrefix: "beep",
});

const started = Metric.counter("fixture_started_total");
const httpMetrics = makeHttpApiMetrics("fixture_http_api");
const httpDescriptor = HttpApiTelemetryDescriptor.make({
  apiName: "fixture-api",
  groupName: "fixture-group",
  endpointName: "health",
  method: "GET",
  route: "/health",
  successStatus: httpApiSuccessStatus(S.String.pipe(HttpApiSchema.status(204))),
});

void loggingConfig;
void layerLocalLgtmServer(serverConfig);
void layerNodeSdkServer(serverConfig);
void renderLogBanner("Server Safe", {
  kind: "phase",
  pretty: PrettyLoggerConfig.make({ theme: "forest", bannerMode: "phase" }),
});
void observeWorkflow(
  {
    name: "fixture-workflow",
    started,
  },
  Effect.void
);
void observeHttpApiHandler(Effect.succeed("ok"), { descriptor: httpDescriptor, metrics: httpMetrics });
void injectTraceContextHeaders();
void Cause.pretty(Cause.fail(new Error("fixture")));
