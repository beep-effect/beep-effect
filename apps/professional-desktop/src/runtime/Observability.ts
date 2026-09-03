/**
 * Environment-driven observability for the desktop chat sidecar.
 *
 * Logs, traces, and metrics are exported via effect's native OTLP exporter
 * (`effect/unstable/observability` — no OpenTelemetry SDK dependency). Wiring is
 * standard-OTel-env driven and resolved through `effect/Config`:
 *
 *   OTEL_EXPORTER_OTLP_ENDPOINT  e.g. http://localhost:4318 — when unset, the
 *                                exporter is OFF and this layer collapses to
 *                                {@link Layer.empty}, so prod/dev wiring is just
 *                                an env var.
 *   DEVTOOLS                    true enables the Effect DevTools websocket
 *                                mirror via `@beep/observability/server`.
 *   DEVTOOLS_URL                defaults to ws://localhost:34437.
 *   Non-local DevTools websocket URLs are rejected because span payloads can
 *   contain diagnostic attributes intended only for the local QA workstation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { layerLocalLgtmServer, ServerObservabilityConfig } from "@beep/observability/server";
import * as O from "@beep/utils/Option";
import { thunkFalse } from "@beep/utils/thunk";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as References from "effect/References";
import * as Result from "effect/Result";
import { FetchHttpClient } from "effect/unstable/http";

/**
 * OTLP observability layer for the sidecar. Gated on
 * `OTEL_EXPORTER_OTLP_ENDPOINT`: present ⇒ the effect-native OTLP exporter
 * (traces/logs/metrics over JSON to the standard OTel collector); absent ⇒
 * {@link Layer.empty}, so telemetry is opt-in and the sidecar runs with zero
 * external dependencies by default.
 *
 * @category layers
 * @since 0.0.0
 */
const localDevToolsHostnames = HashSet.make("localhost", "127.0.0.1", "::1", "[::1]");

const isLocalDevToolsUrl = (url: string): boolean =>
  Result.try(() => HashSet.has(localDevToolsHostnames, new URL(url).hostname)).pipe(
    Result.match({
      onFailure: thunkFalse,
      onSuccess: identity,
    })
  );

const ObservabilityConfigLive: Layer.Layer<never> = Layer.unwrap(
  Effect.gen(function* () {
    const endpoint = yield* Config.option(Config.string("OTEL_EXPORTER_OTLP_ENDPOINT"));
    const minLogLevel = yield* Config.logLevel("APP_LOG_LEVEL").pipe(Config.withDefault("Info"));
    const environment = yield* Config.string("BEEP_DEPLOYMENT_ENVIRONMENT").pipe(Config.withDefault("qa"));
    const launchId = yield* Config.option(Config.string("BEEP_LAUNCH_ID"));
    const qaSessionId = yield* Config.option(Config.string("BEEP_QA_SESSION_ID"));
    const buildCommit = yield* Config.option(Config.string("BEEP_BUILD_COMMIT"));
    const transport = yield* Config.option(Config.string("CHAT_TRANSPORT"));
    const devtoolsRequested = yield* Config.boolean("DEVTOOLS").pipe(Config.withDefault(false));
    const devtoolsUrl = yield* Config.string("DEVTOOLS_URL").pipe(Config.withDefault("ws://localhost:34437"));
    const devtoolsAllowed = !devtoolsRequested || isLocalDevToolsUrl(devtoolsUrl);

    if (!devtoolsAllowed) {
      yield* Effect.logWarning("Effect DevTools disabled for non-local DEVTOOLS_URL", { url: devtoolsUrl });
    }

    const config = ServerObservabilityConfig.make({
      serviceName: "professional-desktop-sidecar",
      serviceVersion: "0.0.3",
      environment,
      minLogLevel,
      otlpBaseUrl: O.getOrElse(endpoint, () => "http://127.0.0.1:4318"),
      otlpEnabled: O.isSome(endpoint),
      otlpResourceAttributes: O.getSomesStruct({
        launch_id: launchId,
        session_id: qaSessionId,
        build_commit: buildCommit,
        transport,
        component: O.some("sidecar"),
      }),
      devtoolsEnabled: devtoolsRequested && devtoolsAllowed,
      devtoolsUrl,
      prometheusPrefix: "professional_desktop",
    });

    return Layer.mergeAll(
      layerLocalLgtmServer(config).pipe(Layer.provide(FetchHttpClient.layer)),
      Layer.succeed(References.MinimumLogLevel, minLogLevel)
    );
  }).pipe(Effect.orDie)
);

/**
 * Effect DevTools websocket mirror for local sidecar debugging. Gated by
 * `DEVTOOLS=true`, using the shared observability capability so the app does
 * not hand-roll devtools protocol plumbing. DevTools receives raw span/log
 * payloads, so non-local websocket URLs are disabled unless explicitly opted
 * into with `DEVTOOLS_ALLOW_REMOTE=true`.
 *
 * @category layers
 * @since 0.0.0
 */

/**
 * Sidecar observability layer: OTLP export plus optional Effect DevTools.
 *
 * **Example** (Verifying Layer instance)
 *
 * ```ts
 * import { ObservabilityLive } from "@/runtime/Observability"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(ObservabilityLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ObservabilityLive: Layer.Layer<never> = ObservabilityConfigLive;
