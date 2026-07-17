/**
 * Client-side observability for the desktop chat webview.
 *
 * The webview exports logs, traces, and metrics over OTLP via effect's native
 * exporter (`effect/unstable/observability`, no OpenTelemetry SDK dependency),
 * as `professional-desktop-web`. Critically, the effect tracer puts the active
 * client span context (traceId/spanId) onto the outgoing rpc request envelope,
 * so the webview's spans and the sidecar's `RpcServer.*` spans join into ONE
 * distributed trace — the SPEC "joined traces" criterion. This module is the
 * client half the POC carried in `src/observability.ts`; the sidecar half lives
 * in the app's `src/runtime/Observability.ts`.
 *
 * Env-gated, browser-safe, NodeNext-safe: this module deliberately avoids
 * `import.meta.env` (vite-only, untyped under NodeNext — the same reason the
 * chat HTTP policy keys off the browser origin rather than vite env).
 * The OTLP base URL is resolved from the live runtime:
 *
 * - An explicit `globalThis.__BEEP_OTLP_URL__` override wins when set (allows a
 *   packaged build to point at a collector directly).
 * - Otherwise, on a real http(s) origin (the vite dev server) the exporter posts
 *   to the same-origin `/otlp` path, which vite proxies to the collector (see
 *   the app's vite.config.ts) — no CORS setup needed.
 * - Otherwise, a packaged Tauri webview uses the loopback OTLP/HTTP collector;
 *   jsdom/SSR still collapses to {@link Layer.empty}, so tests without a
 *   collector remain unaffected.
 *
 * @packageDocumentation
 * @category observability
 * @since 0.0.0
 */

import { LogLevel } from "@beep/schema";
import { O, P, pipe, Str, thunkEmptyReadonlyRecord } from "@beep/utils";
import { Effect, Layer, Metric, References } from "effect";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";
import { Otlp, OtlpSerialization } from "effect/unstable/observability";
import { resolveBrowserHttpUrl } from "./internal/BrowserHttpUrl.ts";
import type { R } from "@beep/utils";

const readRuntimeString = (key: string): O.Option<string> => {
  const runtime: unknown = globalThis;
  return P.hasProperty(runtime, key) && P.isString(runtime[key]) && Str.isNonEmpty(runtime[key])
    ? O.some(runtime[key])
    : O.none();
};

const runtimeAttribute = (key: string, attribute: string): R.ReadonlyRecord<string, string> =>
  O.getOrElse(
    O.map(readRuntimeString(key), (value) => ({ [attribute]: value })),
    thunkEmptyReadonlyRecord<string, string>
  );

// browser/runtime-derived config boundary — no vite env, no node `process`.
const resolveOtlpBaseUrl = (): O.Option<string> =>
  O.orElse(readRuntimeString("__BEEP_OTLP_URL__"), () =>
    pipe(
      resolveBrowserHttpUrl(globalThis.window, "/otlp"),
      O.orElse(() =>
        pipe(
          O.fromUndefinedOr(globalThis.window),
          O.filter((runtimeWindow) => P.hasProperty(runtimeWindow, "__TAURI_INTERNALS__")),
          O.as("http://127.0.0.1:4318")
        )
      )
    )
  );

const resolveMinimumLogLevel = (): LogLevel =>
  O.match(readRuntimeString("__BEEP_LOG_LEVEL__"), {
    onNone: () => LogLevel.Enum.Info,
    onSome: (value) => (S.is(LogLevel)(value) ? value : LogLevel.Enum.Info),
  });

const resourceAttributes = (): R.ReadonlyRecord<string, string> => ({
  "deployment.environment": "qa",
  ...runtimeAttribute("__BEEP_DEPLOYMENT_ENVIRONMENT__", "deployment.environment"),
  ...runtimeAttribute("__BEEP_LAUNCH_ID__", "launch_id"),
  ...runtimeAttribute("__BEEP_QA_SESSION_ID__", "session_id"),
  ...runtimeAttribute("__BEEP_BUILD_COMMIT__", "build_commit"),
  component: "renderer",
});

/**
 * Env-gated client OTLP layer. Present base URL ⇒ the effect-native OTLP
 * exporter (traces/logs/metrics over JSON) whose tracer threads client span
 * context onto rpc envelopes; absent ⇒ {@link Layer.empty}, so the exporter is
 * opt-in and dev/tests without a collector are unaffected.
 *
 * @example
 * ```ts
 * import { ClientObservabilityLive } from "@beep/agents-client"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ClientObservabilityLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ClientObservabilityLive: Layer.Layer<never> = Layer.unwrap(
  Effect.sync(() => {
    const minimumLogLevel = Layer.succeed(References.MinimumLogLevel, resolveMinimumLogLevel());
    const telemetry = O.match(resolveOtlpBaseUrl(), {
      onNone: () => Layer.empty,
      onSome: (baseUrl) =>
        Otlp.layer({
          baseUrl,
          resource: {
            serviceName: "professional-desktop-web",
            serviceVersion: "0.0.3",
            attributes: resourceAttributes(),
          },
        }).pipe(Layer.provide([FetchHttpClient.layer, OtlpSerialization.layerJson])),
    });

    return Layer.mergeAll(telemetry, Metric.enableRuntimeMetricsLayer, minimumLogLevel);
  })
);
