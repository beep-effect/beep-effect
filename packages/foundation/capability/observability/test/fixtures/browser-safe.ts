import {
  LoggingConfig,
  PrettyLoggerConfig,
  renderLogBanner,
  statusClass,
  summarizeCause,
  summarizeExit,
} from "@beep/observability";
import { layerWebSdk, WebObservabilityConfig } from "@beep/observability/web";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import type { ObservabilityCoreConfig } from "@beep/observability";

const coreConfig = {
  serviceName: "beep-web",
  serviceVersion: "0.0.0",
  environment: "test",
  minLogLevel: "Info",
} satisfies ObservabilityCoreConfig;

const loggingConfig = LoggingConfig.make({
  format: "pretty",
  minLogLevel: "Info",
});

const webConfig = WebObservabilityConfig.make({
  serviceName: "beep-web",
  serviceVersion: "0.0.0",
  environment: "test",
  minLogLevel: "Info",
  resourceAttributes: {},
});

void coreConfig;
void loggingConfig;
void layerWebSdk(webConfig);
void PrettyLoggerConfig.make({ theme: "ocean", bannerMode: "all" });
void renderLogBanner("Browser Safe", {
  kind: "startup",
  pretty: PrettyLoggerConfig.make({ theme: "ocean", bannerMode: "all" }),
});
void statusClass(200);
void summarizeCause(Cause.fail(new Error("fixture")));
void summarizeExit(Exit.succeed("ok"));
